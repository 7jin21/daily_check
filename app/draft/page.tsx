'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Confetti from '@/components/ui/Confetti'
import { useCheckinStore } from '@/stores/checkin'
import { useSettingsStore } from '@/stores/settings'
import { getSupabaseClient } from '@/lib/supabase'
import { apiPost } from '@/lib/api-client'
import { generateOfflineDraft } from '@/lib/offline-draft'
import ReflectionQuestion from '@/components/checkin/ReflectionQuestion'

type RewriteInstruction = 'emotional' | 'shorter' | 'positive' | 'formal'

const REWRITE_BUTTONS: { key: RewriteInstruction; label: string }[] = [
  { key: 'emotional', label: '感情豊かに ✨' },
  { key: 'shorter',  label: '短くして 📝' },
  { key: 'positive', label: 'ポジティブに 🌟' },
  { key: 'formal',   label: '丁寧な文体に 📖' },
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

export default function DraftPage() {
  const router = useRouter()
  const {
    getInput,
    checkinDate,
    targetDate,
    draftResult,
    editedDraft,
    setDraftResult,
    setEditedDraft,
    setIsGenerating,
    isGenerating,
    setReflection,
    reset,
  } = useCheckinStore()
  const notificationsEnabled = useSettingsStore((s) => s.settings.notificationsEnabled)

  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedEntryDate, setSavedEntryDate] = useState<string | null>(null)
  const [isOffline, setIsOffline] = useState(false)
  const [rewritingKey, setRewritingKey] = useState<RewriteInstruction | null>(null)
  const [rewriteError, setRewriteError] = useState<string | null>(null)
  const [reflectPhase, setReflectPhase] = useState<'pending' | 'fetching' | 'asking' | 'done'>('pending')
  const [reflectQuestion, setReflectQuestion] = useState<{ question: string; options: string[] } | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const startedRef = useRef(false) // StrictMode(dev)の二重実行で生成/質問が2回走らないようにする

  useEffect(() => {
    const today = getTodayJST()

    // 前日以前のデータでドラフトページに来た場合はチェックインへ戻す
    if (checkinDate && checkinDate !== today) {
      reset()
      router.replace('/checkin')
      return
    }

    const input = getInput()
    if (!input.mood && !input.energy) {
      router.replace('/checkin')
      return
    }

    // editedDraft が空の場合のみ生成/初期化（編集済みなら保持）
    // startedRef で StrictMode(dev) の二重起動を防ぐ（生成・質問が2回走らないように）
    if (!editedDraft && !startedRef.current) {
      startedRef.current = true
      if (draftResult) {
        setEditedDraft(draftResult.draft)
      } else {
        // 生成の「前」に、AIが内省の問いを1つだけ投げる（不要・失敗なら即生成へ）
        startReflectionThenGenerate()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [editedDraft])

  const generateDraft = async () => {
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setIsGenerating(true)
    setIsOffline(false)
    setEditedDraft('')

    const input = getInput()
    const { reflectionQ, reflectionA, targetDate: entryTarget } = useCheckinStore.getState()
    try {
      // 日記本文は text/plain でストリーミングされる。内省Q&Aがあれば文脈として渡す。
      // entryDate は過去日付の書き忘れ救済用（null なら今日扱い）
      const res = await fetch('/api/generate-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, reflectionQ, reflectionA, entryDate: entryTarget ?? undefined }),
        signal: abortRef.current.signal,
      })
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

      const isFallback = res.headers.get('X-Draft-Fallback') === '1'
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let text = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        text += decoder.decode(value, { stream: true })
        setEditedDraft(text)
      }
      text = text.trim()
      if (!text) throw new Error('empty draft')
      setEditedDraft(text)

      if (isFallback) {
        // サーバー側でオフラインテンプレートが使われた
        const offline = generateOfflineDraft(input, entryTarget)
        setDraftResult({ ...offline, draft: text })
        setIsOffline(true)
        return
      }

      // メタ情報（タグ・サマリー・感情）は本文確定後にバックグラウンドで取得。
      // 失敗時はローカル生成のメタにフォールバック
      const offlineMeta = generateOfflineDraft(input, entryTarget)
      setDraftResult({
        draft: text,
        tags: offlineMeta.tags,
        summary: offlineMeta.summary,
        dominantEmotion: offlineMeta.dominantEmotion,
      })
      apiPost<{ tags: string[]; summary: string; dominantEmotion: string }>(
        '/api/draft-meta',
        { draft: text },
        { retry: false }
      )
        .then((meta) => setDraftResult({ draft: text, ...meta }))
        .catch(() => { /* オフラインメタのまま */ })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      console.warn('AI生成失敗、オフラインドラフトを使用します:', err)
      const offlineResult = generateOfflineDraft(input, entryTarget)
      setDraftResult(offlineResult)
      setEditedDraft(offlineResult.draft)
      setIsOffline(true)
    } finally {
      setIsGenerating(false)
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
        getInput(),
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
    router.push('/checkin')
  }

  // ユーザーが手で編集した内容を無確認で破棄しない
  const handleRegenerate = () => {
    const hasEdits =
      draftResult && editedDraft.trim() && editedDraft !== draftResult.draft
    if (hasEdits && !window.confirm('編集した内容は破棄されます。AIに最初から書き直してもらいますか？')) {
      return
    }
    generateDraft()
  }

  const handleRewrite = async (instruction: RewriteInstruction) => {
    if (!editedDraft.trim() || rewritingKey) return
    setRewritingKey(instruction)
    setRewriteError(null)
    try {
      const result = await apiPost<{ draft: string }>('/api/rewrite-draft', {
        draft: editedDraft,
        instruction,
      })
      setEditedDraft(result.draft)
    } catch {
      setRewriteError('AIの書き直しに失敗しました。しばらくしてから再試行してください。')
    } finally {
      setRewritingKey(null)
    }
  }

  const handleSave = async () => {
    if (!editedDraft.trim()) return
    setIsSaving(true)
    setSaveError(null)

    const input = getInput()
    // 過去日付の記録なら targetDate、通常は今日
    const entryDate = useCheckinStore.getState().targetDate ?? getTodayJST()
    // 内省Q&Aは DB 列を増やさず freeform に畳んで残す（将来のAI分析の材料にする）
    const { reflectionQ, reflectionA } = useCheckinStore.getState()
    const freeformToSave = reflectionA?.trim()
      ? `${input.freeform ? input.freeform + '\n\n' : ''}【ふりかえり】${reflectionQ}\n→ ${reflectionA}`
      : input.freeform

    try {
      const supabase = getSupabaseClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data: savedEntry, error: saveDbError } = await supabase
        .from('diary_entries')
        .upsert(
          {
            user_id: user.id,
            entry_date: entryDate,
            mood: input.mood,
            energy: input.energy,
            events: input.events,
            challenges: input.challenges,
            gratitude: input.gratitude,
            freeform: freeformToSave,
            ai_draft: draftResult?.draft ?? editedDraft,
            edited_draft: editedDraft,
            tags: draftResult?.tags ?? [],
            summary: draftResult?.summary ?? '',
            dominant_emotion: draftResult?.dominantEmotion ?? '',
          },
          // PKのidは渡していないため、user_id + entry_date で競合判定しないと
          // 同日2回目の保存が unique 制約違反になる
          { onConflict: 'user_id,entry_date' }
        )
        .select('id')
        .single()

      if (saveDbError) throw new Error(saveDbError.message)

      if (savedEntry) {
        apiPost('/api/notion-sync', {
          entryId: savedEntry.id,
          entryDate,
          draft: editedDraft,
          tags: draftResult?.tags ?? [],
          mood: input.mood,
          energy: input.energy,
        }, { retry: false }).catch((err) => console.warn('Notion同期失敗（無視）:', err))
      }

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
            <h1 className="text-lg font-bold text-[var(--foreground)]">AIが日記を書いています…</h1>
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
          <p className="font-bold text-[var(--foreground)] text-lg">AIが日記を書いています...</p>
          <p className="text-[var(--muted-2)] text-sm mt-1">少々お待ちください ✨</p>
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

  return (
    <div className="min-h-dvh flex flex-col px-4 pt-6">
      <div className="flex items-center gap-3 mb-6">
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

      {isOffline && (
        <div className="mb-4 p-3 rounded-2xl text-sm" style={{ background: 'rgba(197,137,95,0.12)', border: '1px solid rgba(197,137,95,0.35)', color: '#a4683f' }}>
          <p className="font-semibold">⚠️ AI生成に失敗しました</p>
          <p className="mt-0.5 text-xs">ネットワーク接続を確認のうえ「書き直す」を試してください。以下はオフライン生成のドラフトです。</p>
        </div>
      )}

      {draftResult && (
        <div className="mb-4">
          <p className="text-sm text-[var(--muted)] mb-2">{draftResult.summary}</p>
          <div className="flex flex-wrap gap-2">
            {draftResult.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--primary)] text-xs font-medium"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 mb-4">
        <label className="block text-sm font-medium text-[var(--muted)] mb-2">
          編集して保存できます
        </label>
        <textarea
          ref={textareaRef}
          value={editedDraft}
          onChange={(e) => setEditedDraft(e.target.value)}
          className="w-full min-h-40 p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] text-base resize-none overflow-hidden focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
        />

        {/* AI書き直しボタン */}
        <div className="mt-3">
          <p className="text-xs text-[var(--muted-2)] mb-2">AIに書き直してもらう</p>
          <div className="flex flex-wrap gap-2">
            {REWRITE_BUTTONS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleRewrite(key)}
                disabled={!!rewritingKey || isSaving}
                className="px-3 py-1.5 rounded-full text-xs font-medium border border-[var(--border)] text-[var(--muted)] bg-[var(--surface)] disabled:opacity-40 active:scale-95 transition-transform"
              >
                {rewritingKey === key ? '書き直し中...' : label}
              </button>
            ))}
          </div>
          {rewriteError && (
            <p className="mt-2 text-xs" style={{ color: '#9c4a2f' }}>{rewriteError}</p>
          )}
        </div>
      </div>

      {saveError && (
        <div className="mb-4 p-3 rounded-2xl text-sm" style={{ background: 'rgba(181,101,74,0.12)', border: '1px solid rgba(181,101,74,0.35)', color: '#9c4a2f' }}>
          <p className="font-semibold">保存できませんでした</p>
          <p className="mt-0.5 text-xs">{saveError}</p>
        </div>
      )}

      <div className="pb-6 space-y-3">
        <button
          onClick={handleSave}
          disabled={isSaving || !editedDraft.trim()}
          className="w-full py-4 rounded-full bg-[var(--accent)] text-[#f7f4ea] font-bold text-base disabled:opacity-40 active:scale-[0.99] transition-transform"
        >
          {isSaving ? '保存中...' : '保存する 💾'}
        </button>
        <button
          onClick={handleRegenerate}
          disabled={isGenerating || isSaving}
          className="w-full py-3 rounded-full border border-[var(--border)] text-[var(--muted)] text-base disabled:opacity-40"
        >
          🔄 AIに書き直してもらう
        </button>
      </div>
    </div>
  )
}
