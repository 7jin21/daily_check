'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCheckinStore } from '@/stores/checkin'
import { useSettingsStore } from '@/stores/settings'
import { useMemoStore } from '@/stores/memos'
import { apiPost } from '@/lib/api-client'
import { generateOfflineDraft } from '@/lib/offline-draft'
import { hasEntryWithWords, refreshEntryMeta, saveFullEntry } from '@/lib/entry-save'
import { withReflection } from '@/lib/freeform'
import { todayJST } from '@/lib/jst'
import { clearReflectionCache, requestReflection } from '@/lib/reflection-prefetch'
import { analyzeKept, composeBullets, composeRaw, inputKey, type ComposeInput, type DraftMode } from '@/lib/draft-compose'
import ReflectionQuestion from '@/components/checkin/ReflectionQuestion'
import { GeneratingView, ReadingView } from '@/components/draft/WaitingViews'
import SavedView from '@/components/draft/SavedView'
import DraftHeader from '@/components/draft/DraftHeader'
import DraftNotice, { type DraftNoticeKind } from '@/components/draft/DraftNotice'
import DraftModePicker from '@/components/draft/DraftModePicker'
import DraftTags from '@/components/draft/DraftTags'
import { ComparePanel, OwnWordsMeter } from '@/components/draft/OwnWords'
import RewriteButtons, { type RewriteInstruction } from '@/components/draft/RewriteButtons'
import SaveActions from '@/components/draft/SaveActions'
import { classifyError } from '@/components/draft/classify-error'

/** ストアの最新値から、清書の材料（メモ＋内省の答え）を組み立てる */
function currentComposeInput(): ComposeInput {
  const st = useCheckinStore.getState()
  return { ...st.getInput(), reflectionQ: st.reflectionQ, reflectionA: st.reflectionA }
}

/** 記録の対象日。「書き始めた日」で固定する（日付をまたいで開いたままでも、翌日の記録を上書きしない） */
function currentEntryDate(): string {
  const st = useCheckinStore.getState()
  return st.targetDate ?? st.checkinDate ?? todayJST()
}

export default function DraftPage() {
  const router = useRouter()
  const {
    events,
    challenges,
    gratitude,
    freeform,
    reflectionQ,
    reflectionA,
    targetDate,
    draftResult,
    editedDraft,
    draftMode,
    isGenerating,
    setDraftResult,
    setEditedDraft,
    setIsGenerating,
    setReflection,
    setDraftMode,
    setDraftInputKey,
    clearDraft,
    reset,
  } = useCheckinStore()
  const notificationsEnabled = useSettingsStore((s) => s.settings.notificationsEnabled)

  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState<{ date: string; merged: boolean } | null>(null)
  const [willAppend, setWillAppend] = useState(false) // この日の日記がすでにあり、保存すると追記になる
  const [notice, setNotice] = useState<DraftNoticeKind | null>(null)
  const [rewritingKey, setRewritingKey] = useState<RewriteInstruction | null>(null)
  const [rewriteError, setRewriteError] = useState<string | null>(null)
  const [reflectPhase, setReflectPhase] = useState<'pending' | 'fetching' | 'asking' | 'done'>('pending')
  const [reflectQuestion, setReflectQuestion] = useState<{ question: string; options: string[] } | null>(null)
  const [history, setHistory] = useState<{ text: string; mode: DraftMode }[]>([])
  const [compareOpen, setCompareOpen] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const startedRef = useRef(false) // StrictMode(dev)の二重実行で生成/質問が2回走らないようにする
  // 非同期応答の取り違え防止: 生成・書き直しのたびに番号を進め、古い番号の応答は捨てる
  const genRef = useRef(0)
  const rewriteRef = useRef(0)
  const savedRef = useRef(false)
  // 画面にいるか（内省の問いを待っている間に離れたら、そのあと清書を始めない）。
  // genRef では代用できない: StrictMode(dev) の二重実行でクリーンアップが genRef を進めるため
  const mountedRef = useRef(false)

  // 本人のメモ（比較の基準）と、清書のうち本人の言葉の割合
  const original = useMemo(
    () => composeRaw({ mood: null, energy: null, events, challenges, gratitude, freeform, reflectionQ, reflectionA }),
    [events, challenges, gratitude, freeform, reflectionQ, reflectionA]
  )
  const kept = useMemo(() => analyzeKept(original, editedDraft), [original, editedDraft])

  useEffect(() => {
    const st = useCheckinStore.getState()
    const today = todayJST()

    // 前日以前に書き始めたデータでドラフトページに来た場合はチェックインへ戻す
    if (st.checkinDate && st.checkinDate !== today) {
      st.reset()
      router.replace('/checkin')
      return
    }
    const input = st.getInput()
    if (!input.mood && !input.energy) {
      router.replace('/checkin')
      return
    }
    if (startedRef.current) return
    startedRef.current = true

    // この日にすでに言葉のある日記があれば、保存は上書きではなく追記になることを先に伝える
    hasEntryWithWords(currentEntryDate())
      .then((exists) => setWillAppend(exists))
      .catch(() => setWillAppend(false))

    if (st.editedDraft || st.draftResult) {
      const key = inputKey(currentComposeInput())
      // 入力に戻ってメモを変えていたら、古い清書のまま保存しないようにする
      if (st.draftInputKey && st.draftInputKey !== key) {
        const untouched = st.draftMode === 'tidy' && st.editedDraft === st.draftResult?.draft
        if (untouched || window.confirm('メモの内容が変わりました。新しい内容で清書し直しますか？\n（いまのドラフトは置き換わります）')) {
          st.clearDraft()
          st.setReflection('', '')
          startReflectionThenGenerate()
        } else {
          st.setDraftInputKey(key)
        }
        return
      }
      if (!st.editedDraft && st.draftResult) st.setEditedDraft(st.draftResult.draft)
      return
    }
    // 生成の「前」に、AIが内省の問いを1つだけ投げる（不要・失敗なら即生成へ）
    startReflectionThenGenerate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 画面を離れたら進行中の生成を止め、遅れて届く応答はすべて無効にする
  useEffect(() => {
    const abort = abortRef
    const gen = genRef
    const rewrite = rewriteRef
    const mounted = mountedRef
    mounted.current = true
    return () => {
      mounted.current = false
      abort.current?.abort()
      gen.current++
      rewrite.current++
    }
  }, [])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [editedDraft])

  /** AI が使えないとき: 本人のメモをそのまま使う（メモが空ならテンプレート） */
  const fallbackToOwnWords = (full: ComposeInput, entryTarget: string | null) => {
    const raw = composeRaw(full)
    const offline = generateOfflineDraft(full, entryTarget)
    const text = raw || offline.draft
    setDraftResult({ ...offline, draft: text, fromAI: false })
    setEditedDraft(text)
    setDraftMode(raw ? 'raw' : 'tidy')
    setNotice('offline')
  }

  const generateDraft = async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const id = ++genRef.current
    const isCurrent = () => id === genRef.current

    const st = useCheckinStore.getState()
    const full = currentComposeInput()
    const entryTarget = st.targetDate
    setIsGenerating(true)
    setNotice(null)
    setEditedDraft('')
    setDraftMode('tidy')
    setDraftInputKey(inputKey(full))

    let text = ''
    try {
      // 日記本文は text/plain でストリーミングされる。内省Q&Aがあれば文脈として渡す。
      // entryDate は過去日付の書き忘れ救済用（null なら今日扱い）
      const res = await fetch('/api/generate-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...full, entryDate: entryTarget ?? undefined }),
        signal: controller.signal,
      })
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

      const isFallback = res.headers.get('X-Draft-Fallback') === '1'
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      for (;;) {
        const { done, value } = await reader.read()
        if (!isCurrent()) {
          reader.cancel().catch(() => {})
          return
        }
        if (done) break
        text += decoder.decode(value, { stream: true })
        setEditedDraft(text)
      }
      text = text.trim()
      if (!text) throw new Error('empty draft')

      if (isFallback) {
        // サーバーに AI が設定されていない → 本人のメモをそのまま使う
        fallbackToOwnWords(full, entryTarget)
        return
      }

      setEditedDraft(text)
      // メタ情報（タグ・サマリー・感情）は本文確定後にバックグラウンドで取得。失敗時はローカル生成のメタ
      const offlineMeta = generateOfflineDraft(full, entryTarget)
      setDraftResult({
        draft: text,
        tags: offlineMeta.tags,
        summary: offlineMeta.summary,
        dominantEmotion: offlineMeta.dominantEmotion,
        fromAI: true,
      })
      apiPost<{ tags: string[]; summary: string; dominantEmotion: string }>('/api/draft-meta', { draft: text }, { retry: false })
        .then((meta) => {
          // 保存・再生成・画面離脱のあとに届いた応答は捨てる（古い下書きを復活させない）
          if (isCurrent() && !savedRef.current) setDraftResult({ draft: text, ...meta, fromAI: true })
        })
        .catch(() => {
          /* オフラインメタのまま */
        })
    } catch (err) {
      if (!isCurrent()) return
      if (err instanceof DOMException && err.name === 'AbortError') return
      const partial = text.trim()
      if (partial) {
        // 途中まで届いた清書は捨てずに残し、途中で止まったことを伝える
        console.warn('清書が途中で止まりました:', err)
        const meta = generateOfflineDraft(full, entryTarget)
        setDraftResult({ ...meta, draft: partial, fromAI: true })
        setEditedDraft(partial)
        setNotice('partial')
      } else {
        console.warn('AI清書に失敗、本人のメモをそのまま使います:', err)
        fallbackToOwnWords(full, entryTarget)
      }
    } finally {
      if (isCurrent()) setIsGenerating(false)
    }
  }

  // 生成前の内省質問ゲート。問いは入力中に先読みしてあるので、たいていすぐ届く。
  // 不要・失敗・遅延（7秒）なら黙って生成へ進む（requestReflection は例外を投げず、絶対にブロックしない）
  const startReflectionThenGenerate = async () => {
    // 先読み済みなら描画の前に届き、'fetching' は次の段階とまとめて描画されるので待ち画面は残らない
    setReflectPhase('fetching')
    const res = await requestReflection(useCheckinStore.getState().getInput())
    if (!mountedRef.current) return
    if (!res.skip && res.question && Array.isArray(res.options) && res.options.length >= 2) {
      setReflectQuestion({ question: res.question, options: res.options })
      setReflectPhase('asking')
      return
    }
    setReflectPhase('done')
    generateDraft()
  }

  const handleReflectAnswer = (answer: string) => {
    setReflection(reflectQuestion?.question ?? '', answer)
    setReflectPhase('done')
    generateDraft()
  }

  const handleReflectSkip = () => {
    setReflection('', '')
    setReflectPhase('done')
    generateDraft()
  }

  const handleCancel = () => {
    abortRef.current?.abort()
    genRef.current++
    // 途中まで書かれたドラフトを、次に開いたとき完成品のように再利用しない
    clearDraft()
    router.push('/checkin')
  }

  /** いまの整え方で作られる「元の形」（手で直したかどうかの判定に使う） */
  const baseText = (mode: DraftMode): string => {
    if (mode === 'raw') return composeRaw(currentComposeInput())
    if (mode === 'bullets') return composeBullets(currentComposeInput())
    return draftResult?.draft ?? ''
  }

  const pushHistory = () => setHistory((h) => [...h, { text: editedDraft, mode: draftMode }].slice(-10))

  const switchMode = (next: DraftMode) => {
    if (next === draftMode || isGenerating || rewritingKey || isSaving) return
    const edited = editedDraft.trim() && editedDraft !== baseText(draftMode)
    if (edited && !window.confirm('手で直した内容は置き換わります（「元に戻す」で戻せます）。よろしいですか？')) return
    pushHistory()
    setRewriteError(null)
    if (next === 'tidy') {
      if (draftResult?.fromAI) {
        setDraftMode('tidy')
        setEditedDraft(draftResult.draft)
      } else {
        generateDraft() // AI の清書がまだない（または失敗していた）ので作る
      }
      return
    }
    setNotice(null)
    setDraftMode(next)
    setEditedDraft(next === 'raw' ? composeRaw(currentComposeInput()) : composeBullets(currentComposeInput()))
  }

  const handleUndo = () => {
    const last = history[history.length - 1]
    if (!last || isGenerating || rewritingKey) return
    setHistory((h) => h.slice(0, -1))
    setDraftMode(last.mode)
    setEditedDraft(last.text)
  }

  // ユーザーが手で編集した内容を無確認で破棄しない
  const handleRegenerate = () => {
    const hasEdits = draftResult && editedDraft.trim() && editedDraft !== draftResult.draft
    if (hasEdits && !window.confirm('編集した内容は置き換わります（「元に戻す」で戻せます）。清書し直しますか？')) {
      return
    }
    pushHistory()
    generateDraft()
  }

  const handleRewrite = async (instruction: RewriteInstruction) => {
    if (!editedDraft.trim() || rewritingKey || isGenerating) return
    const rid = ++rewriteRef.current
    const before = editedDraft
    setRewritingKey(instruction)
    setRewriteError(null)
    try {
      const result = await apiPost<{ draft: string }>('/api/rewrite-draft', { draft: before, instruction })
      if (rid !== rewriteRef.current || savedRef.current) return
      setHistory((h) => [...h, { text: before, mode: draftMode }].slice(-10))
      setEditedDraft(result.draft)
    } catch {
      if (rid === rewriteRef.current) setRewriteError('AIの書き直しに失敗しました。しばらくしてから再試行してください。')
    } finally {
      if (rid === rewriteRef.current) setRewritingKey(null)
    }
  }

  const handleSave = async () => {
    if (!editedDraft.trim() || isSaving || rewritingKey || isGenerating) return
    setIsSaving(true)
    setSaveError(null)

    const st = useCheckinStore.getState()
    const input = st.getInput()
    const entryDate = currentEntryDate()
    // 内省Q&Aは DB 列を増やさず freeform に畳んで残す（将来のAI分析の材料にする）
    const freeformToSave = withReflection(input.freeform, st.reflectionQ ?? '', st.reflectionA ?? '')

    try {
      // 同じ日に言葉のある日記がすでにあれば、上書きせずに追記される（result.draft は保存された本文全体）
      const result = await saveFullEntry({
        entryDate,
        mood: input.mood,
        energy: input.energy,
        events: input.events,
        challenges: input.challenges,
        gratitude: input.gratitude,
        freeform: freeformToSave,
        aiDraft: draftResult?.draft ?? editedDraft,
        editedDraft,
        tags: draftResult?.tags ?? [],
        summary: draftResult?.summary ?? '',
        dominantEmotion: draftResult?.dominantEmotion ?? '',
      })
      // ここから先に届く生成・メタ・書き直しの応答はすべて無効
      savedRef.current = true
      genRef.current++
      rewriteRef.current++

      // Notion には保存した本文全体を送る（追記した日は前の日記も含めた本文）
      const notion = { entryId: result.id, entryDate, draft: result.draft, mood: input.mood, energy: input.energy }
      const syncNotion = (tags: string[]) =>
        apiPost('/api/notion-sync', { ...notion, tags }, { retry: false }).catch((err) => console.warn('Notion同期失敗（無視）:', err))
      if (result.merged) {
        // 追記した日は、要約・タグを本文全体から作り直してから同期する（作り直せなければ保存時のタグ）
        refreshEntryMeta(result.id, result.draft).then((meta) => syncNotion(meta?.tags ?? result.tags))
      } else {
        syncNotion(draftResult?.tags ?? [])
      }

      // その日のひとことメモは日記に入ったので片付ける
      const memos = useMemoStore.getState()
      if (memos.date === entryDate) memos.clear()

      reset()
      // 先読みした内省の問いは、この日記のためのもの（次のチェックインで使い回さない）
      clearReflectionCache()
      setSaved({ date: entryDate, merged: result.merged })
    } catch (err) {
      console.error('保存エラー:', err)
      const classified = classifyError(err)
      if (classified === 'cancelled') return
      if (classified.includes('セッション')) {
        router.push('/login')
        return
      }
      setSaveError(classified)
    } finally {
      setIsSaving(false)
    }
  }

  // 内省の問いを表示中
  if (reflectPhase === 'asking' && reflectQuestion) {
    return (
      <ReflectionQuestion
        question={reflectQuestion.question}
        options={reflectQuestion.options}
        onSubmit={handleReflectAnswer}
        onSkip={handleReflectSkip}
      />
    )
  }

  // 問いを待っている（最大7秒。失敗すれば自動で生成へ進む）
  if (reflectPhase === 'fetching') return <ReadingView />

  if (isGenerating) return <GeneratingView text={editedDraft} onCancel={handleCancel} />

  if (saved) {
    return (
      <SavedView
        entryDate={saved.date}
        merged={saved.merged}
        isToday={saved.date === todayJST()}
        showReminderNudge={!notificationsEnabled}
      />
    )
  }

  if (!editedDraft && !draftResult) return null

  const busy = isGenerating || !!rewritingKey || isSaving

  return (
    <div className="min-h-dvh flex flex-col px-4 pt-6">
      <DraftHeader targetDate={targetDate} onBack={() => router.push('/checkin')} />

      {notice && <DraftNotice kind={notice} />}

      {/* 整え方 */}
      <DraftModePicker mode={draftMode} disabled={busy} onSelect={switchMode} />

      {draftResult && draftResult.tags.length > 0 && <DraftTags tags={draftResult.tags} />}

      <div className="flex-1 mb-4">
        <textarea
          ref={textareaRef}
          value={editedDraft}
          readOnly={!!rewritingKey}
          aria-label="日記の本文（編集できます）"
          onChange={(e) => setEditedDraft(e.target.value)}
          className="w-full min-h-40 p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] text-base resize-none overflow-hidden focus:outline-none focus:ring-2 focus:ring-[var(--primary)] leading-relaxed"
        />

        {/* 自分の言葉が残っているかを確かめる */}
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {/* 本文が空のときは割合に意味がないので出さない */}
          {original && editedDraft.trim() && (
            <OwnWordsMeter percent={Math.round(kept.own * 100)} open={compareOpen} onToggle={() => setCompareOpen((v) => !v)} />
          )}
          {history.length > 0 && (
            <button type="button" onClick={handleUndo} disabled={busy} className="draft-undo">
              ↶ 元に戻す
            </button>
          )}
        </div>

        {compareOpen && original && editedDraft.trim() && (
          <ComparePanel
            segments={kept.segments}
            original={original}
            keptPercent={Math.round(kept.kept * 100)}
            addedChars={kept.addedChars}
            showUseRaw={draftMode !== 'raw'}
            disabled={busy}
            onUseRaw={() => switchMode('raw')}
          />
        )}

        {/* AI書き直し（任意。AI らしく膨らませたい日に） */}
        <RewriteButtons activeKey={rewritingKey} disabled={busy} error={rewriteError} onRewrite={handleRewrite} />
      </div>

      <SaveActions
        willAppend={willAppend}
        isSaving={isSaving}
        saveError={saveError}
        saveDisabled={busy || !editedDraft.trim()}
        showRegenerate={draftMode === 'tidy'}
        regenerateDisabled={busy}
        onSave={handleSave}
        onRegenerate={handleRegenerate}
      />
    </div>
  )
}
