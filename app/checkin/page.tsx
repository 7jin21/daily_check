'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCheckinStore } from '@/stores/checkin'
import { STEPS, getDailyDescription } from '@/lib/constants'
import MoodStep from '@/components/checkin/MoodStep'
import EnergyStep from '@/components/checkin/EnergyStep'
import TextStep from '@/components/checkin/TextStep'
import { hapticTap } from '@/lib/haptics'

function getTodayJST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
}

export default function CheckinPage() {
  const router = useRouter()
  const {
    currentStep,
    mood,
    energy,
    events,
    challenges,
    gratitude,
    freeform,
    setEvents,
    setChallenges,
    setGratitude,
    setFreeform,
    nextStep,
    prevStep,
  } = useCheckinStore()

  const [direction, setDirection] = useState<'forward' | 'back'>('forward')

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
    }
    checkDateRollover()
    document.addEventListener('visibilitychange', checkDateRollover)
    return () => document.removeEventListener('visibilitychange', checkDateRollover)
  }, [])

  const step = STEPS[currentStep]
  const totalSteps = STEPS.length
  const progress = ((currentStep + 1) / totalSteps) * 100

  const handleNext = () => {
    hapticTap()
    setDirection('forward')
    if (currentStep < totalSteps - 1) {
      nextStep()
    } else {
      router.push('/draft')
    }
  }

  const handleBack = () => {
    if (currentStep === 0) {
      router.push('/')
    } else {
      setDirection('back')
      prevStep()
    }
  }

  const canProceed = () => {
    switch (step?.id) {
      case 'mood':   return mood !== null
      case 'energy': return energy !== null
      default:       return true
    }
  }

  if (!step) return null

  return (
    <div className="min-h-dvh flex flex-col px-4 pt-4">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={handleBack}
          className="w-11 h-11 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xl text-slate-600 dark:text-slate-300 active:scale-90 transition-transform"
          aria-label="戻る"
        >
          ‹
        </button>
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="font-medium">{currentStep + 1} / {totalSteps}</span>
            <span className="tabular-nums">{Math.round(progress)}%</span>
          </div>
          {/* プログレスバー（グロー付き） */}
          <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-sky-400 to-violet-500 rounded-full transition-all duration-300 progress-bar-glow"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* ステップタイトル */}
      <div key={`title-${currentStep}`} className="mb-6 animate-fade-in">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{step.title}</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          {getDailyDescription(step.id) || step.description}
        </p>
      </div>

      {/* ステップコンテンツ（方向付きアニメーション） */}
      <div
        key={currentStep}
        className={`flex-1 ${direction === 'forward' ? 'animate-enter-right' : 'animate-enter-left'}`}
      >
        {step.id === 'mood' && <MoodStep />}
        {step.id === 'energy' && <EnergyStep />}
        {step.id === 'events' && (
          <TextStep value={events} onChange={setEvents} placeholder="今日起きたこと、やったこと、会った人など..." />
        )}
        {step.id === 'challenges' && (
          <TextStep value={challenges} onChange={setChallenges} placeholder="困ったこと、悩み、うまくいかなかったこと..." />
        )}
        {step.id === 'gratitude' && (
          <TextStep value={gratitude} onChange={setGratitude} placeholder="感謝できること、うれしかったこと、よかったこと..." />
        )}
        {step.id === 'freeform' && (
          <TextStep value={freeform} onChange={setFreeform} placeholder="思ったこと、気づいたこと、なんでも..." />
        )}
      </div>

      {/* 次へボタン */}
      <div className="pb-6 pt-4">
        <button
          onClick={handleNext}
          disabled={!canProceed()}
          className="w-full py-4 rounded-3xl animated-gradient text-white font-bold text-lg disabled:opacity-30 active:scale-95 transition-transform shadow-lg shadow-sky-500/20 dark:shadow-sky-500/10"
        >
          {currentStep < totalSteps - 1 ? '次へ →' : 'AIに日記を書いてもらう ✨'}
        </button>
        {(step.id === 'events' || step.id === 'challenges' || step.id === 'gratitude' || step.id === 'freeform') && (
          <p className="text-center text-xs text-slate-400 mt-2">入力しなくても次へ進めます</p>
        )}
      </div>
    </div>
  )
}
