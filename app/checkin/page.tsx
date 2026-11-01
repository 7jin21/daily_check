'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCheckinStore } from '@/stores/checkin'
import { STEPS, getDailyDescription } from '@/lib/constants'
import StateStep from '@/components/checkin/StateStep'
import NotesStep from '@/components/checkin/NotesStep'
import { hapticTap } from '@/lib/haptics'
import { saveMoodOnly } from '@/lib/entry-save'
import { prefetchReflection } from '@/lib/reflection-prefetch'
import { formatJSTDate, todayJST } from '@/lib/jst'
import { hasUnsavedWords, isValidPastDate, planDateRollover } from '@/lib/checkin-rollover'

export default function CheckinPage() {
  const router = useRouter()
  const { currentStep, mood, energy, targetDate, events, challenges, gratitude, freeform, nextStep, prevStep } =
    useCheckinStore()

  const [direction, setDirection] = useState<'forward' | 'back'>('forward')
  const [quickSaving, setQuickSaving] = useState(false)
  const [quickError, setQuickError] = useState<string | null>(null)
  const hasText = [events, challenges, gratitude, freeform].some((v) => v.trim())

  // ステップの説明文は日替わり。/checkin はビルド時に静的生成されるので、描画中に今日の文を選ぶと
  // サーバーの HTML（ビルドした日の文）とブラウザの初回描画（今日の文）が食い違う。
  // 初回描画までは固定の説明文を出し、マウントしてから日替わりの文に切り替える
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  // ?date= で別の日に切り替えるとき、書きかけを消すか一度だけ確かめる
  const dateSwitchAskedRef = useRef(false)

  // 日付またぎの検知。PWA は何日もバックグラウンドに残るため、マウント時だけでなく
  // visibilitychange（スリープ復帰・アプリ切り替え）でも確かめる。
  // 言葉のある書きかけは消さず、書き始めた日の記録として続ける（7日以内。「◯月◯日の記録をあとから書いています」と出る）。
  // 言葉が無い（気分だけ選んだ）書きかけと、7日より前に書き始めたものは消して今日の入力にする
  useEffect(() => {
    const checkDateRollover = () => {
      if (document.visibilityState === 'hidden') return
      const today = todayJST()
      const state = useCheckinStore.getState()
      const plan = planDateRollover(state, today)
      if (plan.kind === 'reset') state.reset()
      if (plan.kind === 'carry') state.setTargetDate(plan.targetDate)
      state.setCheckinDate(today)
      // ステップ構成の変更（旧6ステップ→2ステップ）で保存値が範囲外の場合に備える
      if (state.currentStep >= STEPS.length) state.setCurrentStep(0)
    }
    checkDateRollover()

    // ?date=YYYY-MM-DD → 過去日付の記録（書き忘れ救済）
    const params = new URLSearchParams(window.location.search)
    const dateParam = params.get('date')
    const today = todayJST()
    if (dateParam && isValidPastDate(dateParam, today) && !dateSwitchAskedRef.current) {
      dateSwitchAskedRef.current = true // StrictMode(dev) の二重実行で2回聞かない
      const state = useCheckinStore.getState()
      if (state.targetDate !== dateParam) {
        // 別の日の入力が残っていたら、混ざらないように消してから対象日を設定する。
        // ただし言葉のある書きかけは、黙って消さずに先に確かめる（やめたら書きかけの続きを出す）
        const from = state.targetDate ?? state.checkinDate ?? today
        const label = (d: string) => (d === today ? '今日' : formatJSTDate(d, { month: 'long', day: 'numeric' }))
        const keep =
          hasUnsavedWords(state) &&
          !window.confirm(`${label(from)}の書きかけがあります。消して、${label(dateParam)}の記録を書きますか？\n（キャンセルすると、書きかけの続きを表示します）`)
        if (keep) {
          window.history.replaceState(null, '', '/checkin')
        } else {
          state.reset()
          state.setCheckinDate(today)
          state.setTargetDate(dateParam)
        }
      }
    }

    document.addEventListener('visibilitychange', checkDateRollover)
    return () => document.removeEventListener('visibilitychange', checkDateRollover)
  }, [])

  const stepIndex = Math.min(currentStep, STEPS.length - 1)
  const step = STEPS[stepIndex]
  const totalSteps = STEPS.length
  const progress = ((stepIndex + 1) / totalSteps) * 100

  const handleNext = () => {
    hapticTap()
    setDirection('forward')
    if (stepIndex < totalSteps - 1) {
      nextStep()
    } else {
      // 書き終えてすぐ押したときも、下書き画面に着くまでに問いを作りはじめておく（同じ入力なら作り直さない）
      prefetchReflection(useCheckinStore.getState().getInput())
      router.push('/draft')
    }
  }

  // 気分とエネルギーだけで記録する（疲れた日でも続けられるように。言葉はあとから日記に書き足せる）
  const handleQuickSave = async () => {
    if (quickSaving) return
    const state = useCheckinStore.getState()
    if (state.mood === null || state.energy === null) return
    hapticTap()
    setQuickSaving(true)
    setQuickError(null)
    const entryDate = state.targetDate ?? state.checkinDate ?? todayJST()
    try {
      await saveMoodOnly(entryDate, state.mood, state.energy)
      state.reset()
      router.replace(entryDate === todayJST() ? '/' : `/entries/${entryDate}`)
      router.refresh()
    } catch (err) {
      console.error('気分だけの記録に失敗:', err)
      if (err instanceof Error && err.message === 'Unauthorized') {
        router.push('/login')
        return
      }
      setQuickError('記録できませんでした。通信を確認して、もう一度お試しください。')
      setQuickSaving(false)
    }
  }

  const handleBack = () => {
    if (stepIndex === 0) {
      router.push('/')
    } else {
      setDirection('back')
      prevStep()
    }
  }

  // 対象日を今日に戻す（過去日付モードの解除。入力の混在を防ぐため全部リセット）
  const handleClearTargetDate = () => {
    const state = useCheckinStore.getState()
    // 書いた言葉を消すときは確かめる（日付をまたいで続けている書きかけを、うっかり消さない）
    if (hasUnsavedWords(state) && !window.confirm('書いた内容は消えます。今日の記録に戻しますか？')) return
    state.reset()
    state.setCheckinDate(todayJST())
    router.replace('/checkin')
  }

  const canProceed = () => {
    switch (step?.id) {
      case 'state': return mood !== null && energy !== null
      default:      return true
    }
  }

  if (!step) return null

  return (
    <div className="min-h-dvh flex flex-col px-4 pt-4">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={handleBack}
          className="w-11 h-11 rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] flex items-center justify-center text-xl text-[var(--foreground)] active:scale-90 transition-transform"
          aria-label="戻る"
        >
          ‹
        </button>
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs text-[var(--muted-2)] mb-1.5">
            <span className="font-medium">{stepIndex + 1} / {totalSteps}</span>
            <span className="tabular-nums">{Math.round(progress)}%</span>
          </div>
          {/* プログレスバー（グロー付き） */}
          <div className="h-2 bg-[var(--surface-secondary)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--accent)] rounded-full transition-all duration-300 progress-bar-glow"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* 過去日付の記録バナー */}
      {targetDate && (
        <div className="mb-4 px-4 py-2.5 rounded-2xl flex items-center justify-between text-sm"
          style={{ background: 'rgba(197,137,95,0.12)', border: '1px solid rgba(197,137,95,0.35)', color: '#a4683f' }}
        >
          <span>🕰 <b>{formatJSTDate(targetDate, { month: 'long', day: 'numeric', weekday: 'short' })}</b> の記録をあとから書いています</span>
          <button onClick={handleClearTargetDate} className="text-xs underline ml-3 flex-shrink-0">
            今日に戻す
          </button>
        </div>
      )}

      {/* ステップタイトル */}
      <div key={`title-${stepIndex}`} className="mb-5 animate-fade-in">
        <h2 className="text-2xl font-bold text-[var(--foreground)]">
          {targetDate && step.id === 'state' ? 'その日の調子は？' : step.title}
        </h2>
        <p className="text-[var(--muted)] text-sm mt-1">
          {(mounted && getDailyDescription(step.id)) || step.description}
        </p>
      </div>

      {/* ステップコンテンツ（方向付きアニメーション） */}
      <div
        key={stepIndex}
        className={`flex-1 ${direction === 'forward' ? 'animate-enter-right' : 'animate-enter-left'}`}
      >
        {step.id === 'state' && <StateStep />}
        {step.id === 'notes' && <NotesStep />}
      </div>

      {/* 次へボタン（メモが空なら、清書せずに気分だけで記録する） */}
      <div className="pb-6 pt-4">
        {quickError && (
          <p className="mb-3 text-center text-xs" style={{ color: '#9c4a2f' }} role="alert">
            {quickError}
          </p>
        )}
        {step.id === 'notes' && !hasText ? (
          <button
            onClick={handleQuickSave}
            disabled={!canProceed() || quickSaving}
            className="w-full py-4 rounded-full bg-[var(--accent)] text-[#f7f4ea] font-bold text-base disabled:opacity-30 active:scale-[0.99] transition-transform glow-sky"
          >
            {quickSaving ? '記録しています…' : '気分だけで記録する'}
          </button>
        ) : (
          <button
            onClick={handleNext}
            disabled={!canProceed() || quickSaving}
            className="w-full py-4 rounded-full bg-[var(--accent)] text-[#f7f4ea] font-bold text-base disabled:opacity-30 active:scale-[0.99] transition-transform glow-sky"
          >
            {stepIndex < totalSteps - 1 ? '次へ →' : '日記に清書する ✨'}
          </button>
        )}
        {step.id === 'state' && (
          <button
            onClick={handleQuickSave}
            disabled={!canProceed() || quickSaving}
            className="w-full mt-2 py-2 text-sm text-[var(--muted)] underline underline-offset-4 decoration-[var(--border)] disabled:opacity-30"
          >
            {quickSaving ? '記録しています…' : '今日は気分だけで記録する'}
          </button>
        )}
        {step.id === 'notes' && (
          <p className="text-center text-xs text-[var(--muted-2)] mt-2">
            {hasText ? '書いた言葉のまま、読みやすく整えます' : '言葉は、あとから日記に書き足せます'}
          </p>
        )}
      </div>
    </div>
  )
}
