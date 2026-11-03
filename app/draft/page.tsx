'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCheckinStore } from '@/stores/checkin'
import { useSettingsStore } from '@/stores/settings'
import { useMemoStore } from '@/stores/memos'
import { apiPost } from '@/lib/api-client'
import { syncNotion } from '@/lib/notion-client'
import { readDraftStream } from '@/lib/draft-stream'
import { generateOfflineDraft } from '@/lib/offline-draft'
import { hasEntryWithWords, refreshEntryMeta, saveFullEntry } from '@/lib/entry-save'
import { withReflection } from '@/lib/freeform'
import { metaExcerpt } from '@/lib/entry-merge'
import { todayJST } from '@/lib/jst'
import { entryDateOf, planDateRollover } from '@/lib/checkin-rollover'
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
import { classifyError, rewriteErrorMessage, SAVE_CANCELLED, SESSION_EXPIRED_MESSAGE } from '@/components/draft/classify-error'
import { splitCutMark } from '@/lib/draft-prompt'
import { markSaveEcho } from '@/lib/save-echo'
import { UndoIcon } from '@/components/ui/icons'
import '@/components/draft/draft.css'

/** ストアの最新値から、清書の材料（メモ＋内省の答え）を組み立てる */
function currentComposeInput(): ComposeInput {
  const st = useCheckinStore.getState()
  return { ...st.getInput(), reflectionQ: st.reflectionQ, reflectionA: st.reflectionA }
}

/** 記録の対象日。「書き始めた日」で固定する（日付をまたいで開いたままでも、翌日の記録を上書きしない） */
function currentEntryDate(): string {
  return entryDateOf(useCheckinStore.getState(), todayJST())
}

/** 保存待ちの間に対象日・入力・本文が変わったら、古い保存で消さない。 */
function currentSaveSnapshot(): string {
  const st = useCheckinStore.getState()
  return JSON.stringify({
    resetVersion: st.resetVersion, entryDate: currentEntryDate(),
    input: st.getInput(), reflectionQ: st.reflectionQ, reflectionA: st.reflectionA,
    editedDraft: st.editedDraft, draftMode: st.draftMode,
    draftInputKey: st.draftInputKey, draftIncomplete: st.draftIncomplete,
  })
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
    aiText,
    isGenerating,
    draftIncomplete,
    setDraftResult,
    setEditedDraft,
    setIsGenerating,
    setDraftIncomplete,
    setReflection,
    setDraftMode,
    setDraftInputKey,
    addAiText,
    setStreamDraft,
    reset,
  } = useCheckinStore()
  const notificationsEnabled = useSettingsStore((s) => s.settings.notificationsEnabled)

  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState<{ date: string; merged: boolean; mood: number | null } | null>(null)
  const [willAppend, setWillAppend] = useState(false) // この日の日記がすでにあり、保存すると追記になる
  const [notice, setNotice] = useState<DraftNoticeKind | null>(null)
  const [rewritingKey, setRewritingKey] = useState<RewriteInstruction | null>(null)
  const [rewriteError, setRewriteError] = useState<string | null>(null)
  // 清書の前の問い。問いを出している間だけ、問いと選択肢を持つ
  const [reflect, setReflect] = useState<
    { phase: 'pending' | 'fetching' | 'done' } | { phase: 'asking'; question: string; options: string[] }
  >({ phase: 'pending' })
  const [history, setHistory] = useState<{ text: string; mode: DraftMode; incomplete: boolean }[]>([])
  const [compareOpen, setCompareOpen] = useState(false)
  // 配信中の表示。端末にも draftIncomplete と一緒に保存し、離脱後も途中の言葉を回復できる。
  const [streamText, setStreamText] = useState('')

  const abortRef = useRef<AbortController | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // 非同期応答の取り違え防止: 生成・書き直しのたびに番号を進め、古い番号の応答は捨てる
  const genRef = useRef(0)
  const rewriteRef = useRef(0)
  const reflectionRef = useRef(0)
  const saveRef = useRef(0)
  const savingRef = useRef(false)
  const savedRef = useRef(false)
  // 画面にいるか（離脱後の内省・生成・保存の完了で新しい入力を変更しない）。
  const mountedRef = useRef(false)

  // 本人のメモ（比較の基準）と、清書のうち本人の言葉の割合
  const original = useMemo(
    () => composeRaw({ mood: null, energy: null, events, challenges, gratitude, freeform, reflectionQ, reflectionA }),
    [events, challenges, gratitude, freeform, reflectionQ, reflectionA]
  )
  // この下書きで AI が出した文章。メモに無い言葉のうち、これにも無いもの（下書き画面で自分で書き足した言葉）は
  // 本人の言葉として数える。aiText を持たない古い下書きでも、AI の清書（draftResult）は AI の文章として扱う
  const aiSource = useMemo(
    () => [aiText, draftResult?.fromAI ? draftResult.draft : ''].filter(Boolean).join('\n'),
    [aiText, draftResult]
  )
  // 下書きの画面でだけ使う。生成中は届くたびに計算し直さない（生成中の画面は自分で遅らせて計算している）
  const kept = useMemo(
    () => (isGenerating ? null : analyzeKept(original, editedDraft, aiSource)),
    [isGenerating, original, editedDraft, aiSource]
  )

  useEffect(() => {
    const abort = abortRef
    const gen = genRef
    const rewrite = rewriteRef
    const reflection = reflectionRef
    const save = saveRef
    const saving = savingRef
    mountedRef.current = true
    let active = true
    const initialize = () => {
      const st = useCheckinStore.getState()
      const today = todayJST()

      // 日付またぎは最新の持ち越し仕様を保つ（言葉があれば7日以内の対象日に続ける）。
      const plan = planDateRollover(st, today)
      if (plan.kind === 'reset') {
        st.reset()
        router.replace('/checkin')
        return
      }
      if (plan.kind === 'carry') {
        st.setTargetDate(plan.targetDate)
        st.setCheckinDate(today)
      }
      const input = st.getInput()
      if (!input.mood && !input.energy) {
        router.replace('/checkin')
        return
      }
      st.setIsGenerating(false)

      const date = currentEntryDate()
      const version = st.resetVersion
      const sameEntry = () => active && useCheckinStore.getState().resetVersion === version && currentEntryDate() === date
      hasEntryWithWords(date)
        .then((exists) => { if (sameEntry()) setWillAppend(exists) })
        .catch(() => { if (sameEntry()) setWillAppend(false) })

      if (st.editedDraft || st.draftResult || st.draftIncomplete) {
        const key = inputKey(currentComposeInput())
        if (st.draftInputKey && st.draftInputKey !== key) {
          const untouched = st.draftMode === 'tidy' && st.editedDraft === st.draftResult?.draft
          if (untouched || window.confirm('メモの内容が変わりました。新しい内容で清書し直しますか？\n（いまのドラフトは置き換わります）')) {
            st.clearDraft()
            st.setReflection('', '')
            startReflectionThenGenerate()
            return
          }
          st.setDraftInputKey(key)
        }
        if (st.draftIncomplete) {
          const full = currentComposeInput()
          const offline = generateOfflineDraft(full, currentEntryDate())
          const text = st.editedDraft || composeRaw(full) || offline.draft
          st.setDraftResult({ ...offline, draft: text, fromAI: false })
          st.setEditedDraft(text)
          setNotice('partial')
        } else if (!st.editedDraft && st.draftResult) st.setEditedDraft(st.draftResult.draft)
        setReflect({ phase: 'done' })
        return
      }
      startReflectionThenGenerate()
    }
    initialize()
    // StrictModeでも旧リクエストを無効にし、次のsetupで同じ入力から再開する。
    return () => {
      active = false
      mountedRef.current = false
      abort.current?.abort()
      gen.current++
      rewrite.current++
      reflection.current++
      save.current++
      saving.current = false
      const st = useCheckinStore.getState()
      if (st.isGenerating) st.setIsGenerating(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 開いたまま日付が変わったとき（スリープ復帰・アプリ切り替え）: 保存先は書き始めた日のままなので、
  // 見出しにもその日付を出す（下書きは消さない）
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'hidden') return
      const st = useCheckinStore.getState()
      const today = todayJST()
      const plan = planDateRollover(st, today)
      if (plan.kind !== 'carry') return
      st.setTargetDate(plan.targetDate)
      st.setCheckinDate(today)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    // 枠線の分も足す（scrollHeight は枠線を含まないため、そのままだと最後の行が少し欠ける）
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`
    // 生成が終わって本文の欄が現れたときにも高さを合わせる（本文が変わらないままだと長い清書が欄で切れて見える）
  }, [editedDraft, isGenerating, reflect.phase])

  /** AI が使えないとき: 本人のメモをそのまま使う（メモが空ならテンプレート） */
  const fallbackToOwnWords = (full: ComposeInput, entryTarget: string | null) => {
    const raw = composeRaw(full)
    const offline = generateOfflineDraft(full, entryTarget)
    const text = raw || offline.draft
    setDraftResult({ ...offline, draft: text, fromAI: false })
    setEditedDraft(text)
    setDraftMode(raw ? 'raw' : 'tidy')
    setDraftIncomplete(false)
    setNotice('offline')
  }

  const generateDraft = async () => {
    if (!mountedRef.current || savingRef.current) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const id = ++genRef.current
    const st = useCheckinStore.getState()
    const full = currentComposeInput()
    const previousAiText = st.aiText
    const version = st.resetVersion
    const key = inputKey(full)
    const entryTarget = currentEntryDate()
    const isCurrent = () => mountedRef.current && id === genRef.current &&
      useCheckinStore.getState().resetVersion === version && inputKey(currentComposeInput()) === key &&
      currentEntryDate() === entryTarget
    setIsGenerating(true)
    setDraftIncomplete(true)
    setNotice(null)
    setStreamText('')
    setEditedDraft('')
    setDraftMode('tidy')
    setDraftInputKey(key)

    let text = ''
    // 途中まで届いた清書は捨てずに残し、途中で止まったことを伝える（続きは手で直すか「清書し直す」）
    const keepPartial = (partial: string, reason: unknown) => {
      console.warn('清書が途中で止まりました:', reason)
      const meta = generateOfflineDraft(full, entryTarget)
      setDraftResult({ ...meta, draft: partial, fromAI: false })
      setEditedDraft(partial)
      addAiText(partial)
      setNotice('partial')
    }
    try {
      // 本文とは別の完了通知を受け取るまでは、完成した清書と扱わない。
      const res = await fetch('/api/generate-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
        body: JSON.stringify({ ...full, entryDate: entryTarget ?? undefined }),
        signal: controller.signal,
      })
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

      const isFallback = res.headers.get('X-Draft-Fallback') === '1'
      if (isFallback) {
        if (isCurrent()) fallbackToOwnWords(full, entryTarget)
        return
      }
      await readDraftStream(res.body, (delta) => {
        if (!isCurrent()) throw new DOMException('Obsolete draft', 'AbortError')
        text += delta
        setStreamText(text)
        setStreamDraft(text, [previousAiText, text].filter(Boolean).join('\n'))
      })
      if (!isCurrent()) return
      text = text.trim()
      if (!text) throw new Error('empty draft')

      setEditedDraft(text)
      setDraftIncomplete(false)
      addAiText(text)
      // メタ情報（タグ・サマリー・感情）は本文確定後にバックグラウンドで取得。失敗時はローカル生成のメタ
      const offlineMeta = generateOfflineDraft(full, entryTarget)
      setDraftResult({ ...offlineMeta, draft: text, fromAI: true })
      // draft-meta は 3000 字まで。長い清書は始まりと終わりから作る（超えると要約・タグが作れない）
      apiPost<{ tags: string[]; summary: string; dominantEmotion: string }>('/api/draft-meta', { draft: metaExcerpt(text) }, { retry: false })
        .then((meta) => {
          // 保存・再生成・画面離脱のあとに届いた応答は捨てる（古い下書きを復活させない）
          if (!isCurrent() || savedRef.current) return
          // AI が使えないとき draft-meta は 200 で空の結果を返す。空の項目は手元で作ったもののまま残す
          setDraftResult({
            draft: text,
            tags: meta.tags?.length ? meta.tags : offlineMeta.tags,
            summary: meta.summary || offlineMeta.summary,
            dominantEmotion: meta.dominantEmotion || offlineMeta.dominantEmotion,
            fromAI: true,
          })
        })
        .catch(() => {
          /* オフラインメタのまま */
        })
    } catch (err) {
      if (!isCurrent()) return
      if (err instanceof DOMException && err.name === 'AbortError') return
      const partial = splitCutMark(text).text.trim()
      if (partial) {
        keepPartial(partial, err)
      } else {
        console.warn('AI清書に失敗、本人のメモをそのまま使います:', err)
        fallbackToOwnWords(full, entryTarget)
      }
    } finally {
      if (mountedRef.current && id === genRef.current && useCheckinStore.getState().resetVersion === version) {
        setIsGenerating(false)
      }
    }
  }

  // 生成前の内省質問ゲート。問いは入力中に先読みしてあるので、たいていすぐ届く。
  // 不要・失敗・遅延（7秒）なら黙って生成へ進む（requestReflection は例外を投げず、絶対にブロックしない）
  const startReflectionThenGenerate = async () => {
    const id = ++reflectionRef.current
    const st = useCheckinStore.getState()
    const version = st.resetVersion
    const key = inputKey(currentComposeInput())
    const isCurrent = () => mountedRef.current && id === reflectionRef.current &&
      useCheckinStore.getState().resetVersion === version && inputKey(currentComposeInput()) === key
    // 先読み済みなら描画の前に届き、'fetching' は次の段階とまとめて描画されるので待ち画面は残らない
    setReflect({ phase: 'fetching' })
    const res = await requestReflection(useCheckinStore.getState().getInput())
    if (!isCurrent()) return
    if (!res.skip && res.question && Array.isArray(res.options) && res.options.length >= 2) {
      setReflect({ phase: 'asking', question: res.question, options: res.options })
      return
    }
    setReflect({ phase: 'done' })
    generateDraft()
  }

  /** 問いに答えた・答えずに進んだ（答えなしは空文字）→ 清書へ */
  const finishReflection = (question: string, answer: string) => {
    setReflection(question, answer)
    setReflect({ phase: 'done' })
    generateDraft()
  }

  const handleCancel = () => {
    abortRef.current?.abort()
    genRef.current++
    // 途中の本文と不完全フラグを残し、戻ってきたら編集・再生成できるようにする。
    setIsGenerating(false)
    router.push('/checkin')
  }

  /** いまの整え方で作られる「元の形」（手で直したかどうかの判定に使う） */
  const baseText = (mode: DraftMode): string => {
    if (mode === 'raw') return composeRaw(currentComposeInput())
    if (mode === 'bullets') return composeBullets(currentComposeInput())
    return draftResult?.draft ?? ''
  }

  /** 生成・書き直し・保存のどれかが進んでいる間は、本文を変える操作を受け付けない */
  const locked = () => isGenerating || !!rewritingKey || savingRef.current

  /** 「元に戻す」のために、いまの本文（書き直しなら書き直す前の本文）を覚えておく。最大10件 */
  const pushHistory = (text: string = editedDraft) =>
    setHistory((h) => [...h, { text, mode: draftMode, incomplete: draftIncomplete }].slice(-10))

  const switchMode = (next: DraftMode) => {
    if (next === draftMode || locked()) return
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
    setDraftIncomplete(false)
    setDraftMode(next)
    setEditedDraft(next === 'raw' ? composeRaw(currentComposeInput()) : composeBullets(currentComposeInput()))
  }

  const handleUndo = () => {
    const last = history[history.length - 1]
    if (!last || locked()) return
    setHistory((h) => h.slice(0, -1))
    setDraftMode(last.mode)
    setEditedDraft(last.text)
    setDraftIncomplete(last.incomplete)
    setNotice(last.incomplete ? 'partial' : null)
  }

  // ユーザーが手で編集した内容を無確認で破棄しない
  const handleRegenerate = () => {
    if (locked()) return
    const hasEdits = draftResult && editedDraft.trim() && editedDraft !== draftResult.draft
    if (hasEdits && !window.confirm('編集した内容は置き換わります（「元に戻す」で戻せます）。清書し直しますか？')) {
      return
    }
    pushHistory()
    generateDraft()
  }

  const handleRewrite = async (instruction: RewriteInstruction) => {
    if (!editedDraft.trim() || locked()) return
    const rid = ++rewriteRef.current
    const before = editedDraft
    setRewritingKey(instruction)
    setRewriteError(null)
    try {
      // 自動で再試行しない（長すぎて切れるなど、何度やっても同じ失敗を AI に繰り返させないため）
      const result = await apiPost<{ draft: string }>('/api/rewrite-draft', { draft: before, instruction }, { retry: false })
      if (rid !== rewriteRef.current || savedRef.current) return
      pushHistory(before)
      setEditedDraft(result.draft)
      // AI の言葉として覚えるのは、書き直しで新しく足された言葉だけ（書き直す前の本文には本人が書き足した言葉もある）
      addAiText(
        analyzeKept(before, result.draft)
          .segments.filter((s) => s.added && !s.connector)
          .map((s) => s.text)
          .join('\n')
      )
    } catch (err) {
      if (rid === rewriteRef.current) setRewriteError(rewriteErrorMessage(err))
    } finally {
      if (rid === rewriteRef.current) setRewritingKey(null)
    }
  }

  const handleSave = async () => {
    const st = useCheckinStore.getState()
    if (!mountedRef.current || !st.editedDraft.trim() || savingRef.current || rewritingKey || st.isGenerating) return
    savingRef.current = true
    const id = ++saveRef.current
    const snapshot = currentSaveSnapshot()
    const ownsSave = () => mountedRef.current && id === saveRef.current
    const canClearDraft = () => ownsSave() && currentSaveSnapshot() === snapshot
    const textToSave = st.editedDraft
    const resultToSave = st.draftResult
    setIsSaving(true)
    setSaveError(null)

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
        aiDraft: resultToSave?.draft ?? textToSave,
        editedDraft: textToSave,
        tags: resultToSave?.tags ?? [],
        summary: resultToSave?.summary ?? '',
        dominantEmotion: resultToSave?.dominantEmotion ?? '',
      })

      // Notion には保存した本文全体を送る（追記した日は前の日記も含めた本文）
      const notion = { entryId: result.id, entryDate, draft: result.draft, mood: input.mood, energy: input.energy }
      const syncSavedEntry = (tags: string[]) =>
        syncNotion({ ...notion, tags }).catch((err) => console.warn('Notion同期失敗（無視）:', err))
      if (result.merged) {
        // 追記した日は、要約・タグを本文全体から作り直してから同期する（作り直せなければ保存時のタグ）
        refreshEntryMeta(result.id, result.draft).then((meta) => syncSavedEntry(meta?.tags ?? result.tags))
      } else {
        syncSavedEntry(result.tags)
      }

      // 保存が届いても、離脱後・リセット後・別入力への切替後の下書きは消さない。
      if (!canClearDraft()) return
      savedRef.current = true
      genRef.current++
      rewriteRef.current++

      // 日記に入ったひとことメモだけを片付ける（入りきらなかった・選ばなかったメモは、その日のうちは残す。
      // 以前はすべて消していたため、上限で入らなかったメモがそのまま失われていた）
      const memos = useMemoStore.getState()
      if (memos.date === entryDate) {
        memos.removeUsedIn([input.events, input.challenges, input.gratitude, input.freeform, textToSave].join('\n'))
      }

      reset()
      // 先読みした内省の問いは、この日記のためのもの（次のチェックインで使い回さない）
      clearReflectionCache()
      // ホームに戻ったら、その日の丸に色が落ちる（保存画面の「水面に一滴」の続き）
      markSaveEcho(entryDate, input.mood)
      // 「追記しました」と出すのは、実際に言葉が足されたときだけ（保存のやり直しで何も足されなかったときは出さない）
      setSaved({ date: entryDate, merged: result.appended, mood: input.mood })
    } catch (err) {
      console.error('保存エラー:', err)
      if (!canClearDraft()) return
      const classified = classifyError(err)
      if (classified === SAVE_CANCELLED) return
      if (classified === SESSION_EXPIRED_MESSAGE) {
        router.push('/login')
        return
      }
      setSaveError(classified)
      // 保存は届いていたのに応答だけ失われた場合、次の保存は追記になる。案内を出し直す
      hasEntryWithWords(entryDate)
        .then((exists) => { if (canClearDraft()) setWillAppend(exists) })
        .catch(() => {})
    } finally {
      if (id === saveRef.current) {
        savingRef.current = false
        if (mountedRef.current) setIsSaving(false)
      }
    }
  }

  // 内省の問いを表示中
  if (reflect.phase === 'asking') {
    const { question, options } = reflect
    return (
      <ReflectionQuestion
        question={question}
        options={options}
        onSubmit={(answer) => finishReflection(question, answer)}
        onSkip={() => finishReflection('', '')}
      />
    )
  }

  // 問いを待っている（最大7秒。失敗すれば自動で生成へ進む）
  if (reflect.phase === 'fetching') return <ReadingView />

  if (isGenerating) return <GeneratingView text={streamText} original={original} onCancel={handleCancel} />

  if (saved) {
    return (
      <SavedView
        entryDate={saved.date}
        mood={saved.mood}
        merged={saved.merged}
        isToday={saved.date === todayJST()}
        showReminderNudge={!notificationsEnabled}
      />
    )
  }

  if (!editedDraft && !draftResult) return null

  const busy = isGenerating || !!rewritingKey || isSaving
  // 本文が空のときは割合に意味がないので出さない
  const ownWords = original && editedDraft.trim() ? kept : null

  return (
    <div className="screen animate-fade-in">
      <DraftHeader targetDate={targetDate} disabled={busy} onBack={() => { if (!locked()) router.push('/checkin') }} />

      {(notice || draftIncomplete) && <DraftNotice kind={draftIncomplete ? 'partial' : notice!} />}

      {/* 整え方 */}
      <DraftModePicker mode={draftMode} disabled={busy} onSelect={switchMode} />

      {draftResult && draftResult.tags.length > 0 && <DraftTags tags={draftResult.tags} />}

      <div className="flex-1 mb-4">
        <textarea
          ref={textareaRef}
          value={editedDraft}
          readOnly={busy}
          aria-label="日記の本文（編集できます）"
          onChange={(e) => { if (!savingRef.current && !rewritingKey) setEditedDraft(e.target.value) }}
          className="dv-textarea"
        />

        {/* 自分の言葉が残っているかを確かめる */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {ownWords && (
            <OwnWordsMeter percent={Math.round(ownWords.own * 100)} open={compareOpen} onToggle={() => setCompareOpen((v) => !v)} />
          )}
          {history.length > 0 && (
            <button type="button" onClick={handleUndo} disabled={busy} className="draft-undo">
              <UndoIcon size={15} />
              元に戻す
            </button>
          )}
        </div>

        {compareOpen && ownWords && (
          <ComparePanel
            segments={ownWords.segments}
            original={original}
            keptPercent={Math.round(ownWords.kept * 100)}
            addedChars={ownWords.addedChars}
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
