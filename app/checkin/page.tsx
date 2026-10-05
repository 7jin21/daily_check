'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCheckinStore } from '@/stores/checkin'
import { STEPS, getDailyDescription } from '@/lib/constants'
import StateStep from '@/components/checkin/StateStep'
import NotesStep from '@/components/checkin/NotesStep'
import { hapticTap } from '@/lib/haptics'
import { saveMoodOnly } from '@/lib/entry-save'

function getTodayJST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
}

// 過去日付の記録（書き忘れ救済）は7日前まで許可する
function isValidPastDate(date: string, today: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  if (date >= today) return false
  const diffDays = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86_400_000
  return diffDays <= 7
}

function formatDateLabel(date: string): string {
  return new Date(`${date}T12:00:00+09:00`).toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
}

export default function CheckinPage() {
  const router = useRouter()
  const { currentStep, mood, energy, targetDate, events, challenges, gratitude, freeform, nextStep, prevStep } =
    useCheckinStore()

  const [direction, setDirection] = useState<'forward' | 'back'>('forward')
  const [quickSaving, setQuickSaving] = useState(false)
  const [quickError, setQuickError] = useState<string | null>(null)
  const hasText = [events, challenges, gratitude, freeform].some((v) => v.trim())

  // 前日以前のデータが残っていたら自動クリア
  // PWA は何日もバックグラウンドに残るため、マウント時だけでなく
  // visibilitychange（スリープ復帰・アプリ切り替え）でも日付またぎを検知する
  useEffect(() => {
    const checkDateRollover = () => {
      if (document.visibilityState === 'hidden') return
      const today = getTodayJST()
      const state = useCheckinStore.getState()
      if (state.checkinDate && state.checkinDate !== today) {
        state.reset()
      }
      state.setCheckinDate(today)
      // ステップ構成の変更（旧6ステップ→2ステップ）で保存値が範囲外の場合に備える
      if (state.currentStep >= STEPS.length) state.setCurrentStep(0)
    }
    checkDateRollover()

    // ?date=YYYY-MM-DD → 過去日付の記録（書き忘れ救済）
    const params = new URLSearchParams(window.location.search)
    const dateParam = params.get('date')
    const today = getTodayJST()
    if (dateParam && isValidPastDate(dateParam, today)) {
      const state = useCheckinStore.getState()
      if (state.targetDate !== dateParam) {
        // 別の日の入力が残っていたら混ざらないように消してから対象日を設定
        state.reset()
        state.setCheckinDate(today)
        state.setTargetDate(dateParam)
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
    const entryDate = state.targetDate ?? state.checkinDate ?? getTodayJST()
    try {
      await saveMoodOnly(entryDate, state.mood, state.energy)
      state.reset()
      router.replace(entryDate === getTodayJST() ? '/' : `/entries/${entryDate}`)
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
    state.reset()
    state.setCheckinDate(getTodayJST())
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
          <span>🕰 <b>{formatDateLabel(targetDate)}</b> の記録をあとから書いています</span>
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
          {getDailyDescription(step.id) || step.description}
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
