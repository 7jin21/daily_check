'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Confetti from '@/components/ui/Confetti'
import { useCheckinStore } from '@/stores/checkin'
import { useSettingsStore } from '@/stores/settings'
import { useMemoStore } from '@/stores/memos'
import { apiPost } from '@/lib/api-client'
import { generateOfflineDraft } from '@/lib/offline-draft'
import { saveFullEntry } from '@/lib/entry-save'
import {
  DRAFT_MODES,
  analyzeKept,
  composeBullets,
  composeRaw,
  inputKey,
  type ComposeInput,
  type DraftMode,
} from '@/lib/draft-compose'
import ReflectionQuestion from '@/components/checkin/ReflectionQuestion'

type RewriteInstruction = 'emotional' | 'shorter' | 'positive' | 'formal'

const REWRITE_BUTTONS: { key: RewriteInstruction; label: string }[] = [
  { key: 'emotional', label: '感情豊かに ✨' },
  { key: 'shorter', label: '短くして 📝' },
  { key: 'positive', label: 'ポジティブに 🌟' },
  { key: 'formal', label: '丁寧な文体に 📖' },
]

function getTodayJST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
}

function classifyError(err: unknown): string {
  if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
  if (err instanceof TypeError && err.message.includes('fetch')) {
    return 'ネットワークに接続できません。Wi-Fiやモバイルデータ通信を確認してください。'
  }
  if (err instanceof Error) {
    if (err.message.includes('401') || err.message.includes('Unauthorized')) {
      return 'セッションが切れました。再ログインしてください。'
    }
    if (err.message.includes('500') || err.message.includes('Server error')) {
      return 'サーバーで問題が発生しました。時間をおいて再試行してください。'
    }
    return err.message
  }
  return '保存に失敗しました。時間をおいて再試行してください。'
}

/** ストアの最新値から、清書の材料（メモ＋内省の答え）を組み立てる */
function currentComposeInput(): ComposeInput {
  const st = useCheckinStore.getState()
  return { ...st.getInput(), reflectionQ: st.reflectionQ, reflectionA: st.reflectionA }
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
  const [savedEntryDate, setSavedEntryDate] = useState<string | null>(null)
  const [notice, setNotice] = useState<'offline' | 'partial' | null>(null)
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

  // 本人のメモ（比較の基準）と、清書に残っている割合
  const original = useMemo(
    () => composeRaw({ mood: null, energy: null, events, challenges, gratitude, freeform, reflectionQ, reflectionA }),
    [events, challenges, gratitude, freeform, reflectionQ, reflectionA]
  )
  const kept = useMemo(() => analyzeKept(original, editedDraft), [original, editedDraft])

  useEffect(() => {
    const st = useCheckinStore.getState()
    const today = getTodayJST()

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
    return () => {
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

  // 生成前の内省質問ゲート。質問が不要/失敗/遅延（7秒）なら黙って生成へ進む（絶対にブロックしない）。
  const startReflectionThenGenerate = async () => {
    setReflectPhase('fetching')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 7000)
    try {
      const res = await apiPost<{ skip: boolean; question?: string; options?: string[] }>(
        '/api/checkin-question',
        useCheckinStore.getState().getInput(),
        { signal: controller.signal }
      )
      clearTimeout(timer)
      if (!res.skip && res.question && Array.isArray(res.options) && res.options.length >= 2) {
        setReflectQuestion({ question: res.question, options: res.options })
        setReflectPhase('asking')
        return
      }
    } catch {
      // 失敗・タイムアウト → 質問なしで生成へ
    }
    clearTimeout(timer)
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
    // 記録の対象日は「書き始めた日」で固定する（日付をまたいで開いたままでも、翌日の記録を上書きしない）
    const entryDate = st.targetDate ?? st.checkinDate ?? getTodayJST()
    // 内省Q&Aは DB 列を増やさず freeform に畳んで残す（将来のAI分析の材料にする）
    const freeformToSave = st.reflectionA?.trim()
      ? `${input.freeform ? input.freeform + '\n\n' : ''}【ふりかえり】${st.reflectionQ}\n→ ${st.reflectionA}`
      : input.freeform

    try {
      const entryId = await saveFullEntry({
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

      apiPost(
        '/api/notion-sync',
        {
          entryId,
          entryDate,
          draft: editedDraft,
          tags: draftResult?.tags ?? [],
          mood: input.mood,
          energy: input.energy,
        },
        { retry: false }
      ).catch((err) => console.warn('Notion同期失敗（無視）:', err))

      // その日のひとことメモは日記に入ったので片付ける
      const memos = useMemoStore.getState()
      if (memos.date === entryDate) memos.clear()

      reset()
      setSavedEntryDate(entryDate)
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

  // 問いを生成中（最大7秒。失敗すれば自動で生成へ進む）
  if (reflectPhase === 'fetching') {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-4 gap-6">
        <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
        <p className="text-[var(--muted-2)] text-sm">今日の記録を読んでいます…</p>
      </div>
    )
  }

  if (isGenerating) {
    // ストリーミング中: 文字が書かれていく様子をリアルタイム表示
    if (editedDraft) {
      return (
        <div className="min-h-dvh flex flex-col px-4 pt-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="spinner" style={{ width: 20, height: 20 }} />
            <h1 className="text-lg font-bold text-[var(--foreground)]">あなたの言葉を清書しています…</h1>
          </div>
          <div className="card flex-1 mb-4 overflow-y-auto">
            <p className="text-base text-[var(--foreground)] whitespace-pre-wrap leading-relaxed">
              {editedDraft}
              <span className="typing-cursor" aria-hidden="true" />
            </p>
          </div>
          <div className="pb-6">
            <button
              onClick={handleCancel}
              className="w-full py-3 rounded-full border border-[var(--border)] text-[var(--muted)] text-sm"
            >
              キャンセルして入力に戻る
            </button>
          </div>
        </div>
      )
    }

    // 最初のトークンが届くまでの待機画面
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-4 gap-6">
        <div className="spinner" style={{ width: 48, height: 48, borderWidth: 3 }} />
        <div className="text-center">
          <p className="font-bold text-[var(--foreground)] text-lg">あなたの言葉を清書しています…</p>
          <p className="text-[var(--muted-2)] text-sm mt-1">言い回しはそのまま、つなぎだけ整えます</p>
        </div>
        <button
          onClick={handleCancel}
          className="px-6 py-3 rounded-full border border-[var(--border)] text-[var(--muted)] text-sm"
        >
          キャンセルして入力に戻る
        </button>
      </div>
    )
  }

  if (savedEntryDate) {
    return (
      <>
        <Confetti />
        <div className="min-h-dvh flex flex-col items-center justify-center px-4 gap-6 animate-fade-in">
          <div className="text-7xl animate-float">✨</div>
          <div className="text-center">
            <p className="font-bold text-[var(--foreground)] text-2xl">保存しました！</p>
            <p className="text-[var(--muted)] text-sm mt-1">今日も記録できました</p>
          </div>
          <div className="w-full space-y-3">
            <Link
              href={`/entries/${savedEntryDate}`}
              className="block w-full py-4 text-center rounded-full bg-[var(--accent)] text-[#f7f4ea] font-bold text-base active:scale-[0.99] transition-transform glow-sky"
            >
              日記を見る
            </Link>
            <Link
              href="/"
              className="block w-full py-3 text-center rounded-full border border-[var(--border)] text-[var(--muted)] text-base active:scale-95 transition-transform"
            >
              ホームに戻る
            </Link>
            {/* 記録の習慣化ナッジ: リマインダー未設定の場合のみ */}
            {!notificationsEnabled && (
              <Link
                href="/settings"
                className="block w-full py-2 text-center text-xs text-[var(--muted)] underline underline-offset-2"
              >
                🔔 リマインダーを設定して、記録を習慣にする
              </Link>
            )}
          </div>
        </div>
      </>
    )
  }

  if (!editedDraft && !draftResult) return null

  const keptPercent = Math.round(kept.kept * 100)
  const busy = isGenerating || !!rewritingKey || isSaving

  return (
    <div className="min-h-dvh flex flex-col px-4 pt-6">
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => router.push('/checkin')}
          className="w-11 h-11 rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] flex items-center justify-center text-xl text-[var(--foreground)]"
          aria-label="入力に戻る"
        >
          ‹
        </button>
        <h1 className="text-xl font-bold text-[var(--foreground)]">
          {targetDate
            ? `${new Date(`${targetDate}T12:00:00+09:00`).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'long', day: 'numeric' })}の日記のドラフト`
            : '日記のドラフト'}
        </h1>
      </div>

      {notice && (
        <div
          className="mb-4 p-3 rounded-2xl text-sm"
          style={{ background: 'rgba(197,137,95,0.12)', border: '1px solid rgba(197,137,95,0.35)', color: '#a4683f' }}
        >
          {notice === 'offline' ? (
            <>
              <p className="font-semibold">AI に接続できませんでした</p>
              <p className="mt-0.5 text-xs">書いたメモをそのまま使っています。「整える」を押すと清書を再試行します。</p>
            </>
          ) : (
            <>
              <p className="font-semibold">清書が途中で止まりました</p>
              <p className="mt-0.5 text-xs">続きは手で直すか、「清書し直す」を押してください。</p>
            </>
          )}
        </div>
      )}

      {/* 整え方 */}
      <div className="mb-4">
        <div role="radiogroup" aria-label="整え方" className="draft-modes">
          {DRAFT_MODES.map((m) => (
            <button
              key={m.value}
              role="radio"
              aria-checked={draftMode === m.value}
              data-active={draftMode === m.value}
              onClick={() => switchMode(m.value)}
              disabled={busy}
              className="draft-mode"
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-[var(--muted)] px-1">{DRAFT_MODES.find((m) => m.value === draftMode)?.hint}</p>
      </div>

      {draftResult && draftResult.tags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {draftResult.tags.map((tag) => (
            <span
              key={tag}
              className="px-3 py-1 rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--primary)] text-xs font-medium"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

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
          {original && (
            <button
              type="button"
              onClick={() => setCompareOpen((v) => !v)}
              aria-expanded={compareOpen}
              className="draft-kept"
            >
              <span className="draft-kept-meter" aria-hidden="true">
                <span style={{ width: `${keptPercent}%` }} />
              </span>
              あなたの言葉 {keptPercent}%
              <span className="text-[var(--muted-2)]">{compareOpen ? '▴' : '▾'}</span>
            </button>
          )}
          {history.length > 0 && (
            <button type="button" onClick={handleUndo} disabled={busy} className="draft-undo">
              ↶ 元に戻す
            </button>
          )}
        </div>

        {compareOpen && original && (
          <div className="mt-3 card animate-fade-in" style={{ padding: 16 }}>
            <p className="text-xs font-bold text-[var(--muted)] tracking-wide">いまの本文</p>
            <p className="mt-2 text-[15px] leading-loose text-[var(--foreground)] whitespace-pre-wrap">
              {kept.segments.map((s, i) =>
                s.added ? (
                  <mark key={i} className="ai-added">
                    {s.text}
                  </mark>
                ) : (
                  <span key={i}>{s.text}</span>
                )
              )}
            </p>
            <p className="mt-2 text-[11px] text-[var(--muted)]">
              <mark className="ai-added">下線</mark> は、あなたのメモに無かった言葉です。
            </p>
            <p className="mt-4 text-xs font-bold text-[var(--muted)] tracking-wide">あなたが書いたメモ</p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)] whitespace-pre-wrap">{original}</p>
            {draftMode !== 'raw' && (
              <button type="button" onClick={() => switchMode('raw')} disabled={busy} className="mt-3 draft-undo">
                メモのままにする
              </button>
            )}
          </div>
        )}

        {/* AI書き直し（任意。AI らしく膨らませたい日に） */}
        <div className="mt-5">
          <p className="text-xs text-[var(--muted-2)] mb-2">AIに書き直してもらう（言葉が変わります）</p>
          <div className="flex flex-wrap gap-2">
            {REWRITE_BUTTONS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleRewrite(key)}
                disabled={busy}
                className="px-3 py-1.5 rounded-full text-xs font-medium border border-[var(--border)] text-[var(--muted)] bg-[var(--surface)] disabled:opacity-40 active:scale-95 transition-transform"
              >
                {rewritingKey === key ? '書き直し中...' : label}
              </button>
            ))}
          </div>
          {rewriteError && (
            <p className="mt-2 text-xs" style={{ color: '#9c4a2f' }}>
              {rewriteError}
            </p>
          )}
        </div>
      </div>

      {saveError && (
        <div
          className="mb-4 p-3 rounded-2xl text-sm"
          style={{ background: 'rgba(181,101,74,0.12)', border: '1px solid rgba(181,101,74,0.35)', color: '#9c4a2f' }}
        >
          <p className="font-semibold">保存できませんでした</p>
          <p className="mt-0.5 text-xs">{saveError}</p>
        </div>
      )}

      <div className="pb-6 space-y-3">
        <button
          onClick={handleSave}
          disabled={busy || !editedDraft.trim()}
          className="w-full py-4 rounded-full bg-[var(--accent)] text-[#f7f4ea] font-bold text-base disabled:opacity-40 active:scale-[0.99] transition-transform"
        >
          {isSaving ? '保存中...' : '保存する 💾'}
        </button>
        {draftMode === 'tidy' && (
          <button
            onClick={handleRegenerate}
            disabled={busy}
            className="w-full py-3 rounded-full border border-[var(--border)] text-[var(--muted)] text-base disabled:opacity-40"
          >
            🔄 清書し直す
          </button>
        )}
      </div>
    </div>
  )
}
