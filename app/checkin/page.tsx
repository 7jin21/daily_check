'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useShallow } from 'zustand/react/shallow'
import { useCheckinStore } from '@/stores/checkin'
import { STEPS, getDailyDescription } from '@/lib/constants'
import StateStep from '@/components/checkin/StateStep'
import NotesStep from '@/components/checkin/NotesStep'
import { hapticTap } from '@/lib/haptics'
import { markSaveEcho } from '@/lib/save-echo'
import { prefetchReflection } from '@/lib/reflection-prefetch'
import { dayOfWeek, formatJSTDate, shortDate, todayJST } from '@/lib/jst'
import { entryDateOf, hasUnsavedWords, isValidPastDate, planDateRollover } from '@/lib/checkin-rollover'
import { ArrowRightIcon, ChevronLeftIcon, PenIcon } from '@/components/ui/icons'
import { EnergyGlyph, MoodGlyph } from '@/components/ui/StateGlyphs'
import { WEEKDAY_KANJI } from '@/lib/almanac'
import Wbr from '@/components/ui/Wbr'
import '@/components/checkin/checkin.css'

export default function CheckinPage() {
  const router = useRouter()
  // 入力のたびに画面全体を描き直さないよう、使う値だけを選んで受け取る（メモの中身は「書いたかどうか」だけ）
  const { currentStep, mood, energy, targetDate, checkinDate, nextStep, prevStep } = useCheckinStore(
    useShallow((s) => ({
      currentStep: s.currentStep,
      mood: s.mood,
      energy: s.energy,
      targetDate: s.targetDate,
      checkinDate: s.checkinDate,
      nextStep: s.nextStep,
      prevStep: s.prevStep,
    }))
  )
  const hasText = useCheckinStore((s) => [s.events, s.challenges, s.gratitude, s.freeform].some((v) => v.trim()))

  const [direction, setDirection] = useState<'forward' | 'back'>('forward')
  const [quickSaving, setQuickSaving] = useState(false)
  const [quickError, setQuickError] = useState<string | null>(null)

  // 「気分だけで記録する」の保存処理は Supabase の部品ごと重いので、最初の画面には含めず、
  // 画面が落ち着いてから読み込んでおく（押したときには、たいてい読み込み済み）
  useEffect(() => {
    const load = () => void import('@/lib/entry-save')
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(load)
      return () => window.cancelIdleCallback(id)
    }
    const timer = setTimeout(load, 1500)
    return () => clearTimeout(timer)
  }, [])

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
        const from = entryDateOf(state, today)
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
    const entryDate = entryDateOf(state, todayJST())
    try {
      const { saveMoodOnly } = await import('@/lib/entry-save')
      await saveMoodOnly(entryDate, state.mood, state.energy)
      // ホームに戻ったら、その日の丸に色が落ちる（保存したことが目で分かるように）
      markSaveEcho(entryDate, state.mood)
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

  if (!step) return null

  const canProceed = step.id !== 'state' || (mood !== null && energy !== null)

  // 何が足りないかを、押せないボタンの文字で伝える（押せない理由が分からないまま止まらないように）
  const missing = mood === null && energy === null ? '気分と|エネルギー' : mood === null ? '気分' : energy === null ? 'エネルギー' : null
  // 書いている日（過去の日付を書いているときはその日）。初回描画はサーバーと合わせるため、マウント後に出す
  const dateLabel = mounted ? entryDateOf({ targetDate, checkinDate }, todayJST()) : null

  return (
    <div className="screen">
      {/* 見出しの帯: 戻る ／ いまの段 ／ 日付 */}
      <header className="screen-head ck-head">
        <button type="button" onClick={handleBack} className="icon-btn" aria-label={stepIndex === 0 ? 'ホームに戻る' : '前の画面に戻る'}>
          <ChevronLeftIcon />
        </button>
        <ol className="ck-steps" aria-label={`全${totalSteps}画面のうち${stepIndex + 1}画面目`}>
          {STEPS.map((st, i) => (
            <li key={st.id} data-state={i === stepIndex ? 'current' : i < stepIndex ? 'done' : 'todo'} aria-current={i === stepIndex ? 'step' : undefined}>
              {st.id === 'state' ? '調子' : 'ことば'}
            </li>
          ))}
        </ol>
        <div className="ck-head-end">
          {/* 2画面目では、選んだ調子を小さく添えておく */}
          {step.id === 'notes' && mood !== null && energy !== null && (
            <span className="flex items-center gap-1" aria-hidden="true">
              <MoodGlyph mood={mood} size={20} />
              <EnergyGlyph energy={energy} size={20} />
            </span>
          )}
          {dateLabel && (
            <span className="ck-date">
              {shortDate(dateLabel)}
              <small>{WEEKDAY_KANJI[dayOfWeek(dateLabel)]}</small>
            </span>
          )}
        </div>
      </header>

      {/* 過去日付の記録 */}
      {targetDate && (
        <div className="notice ck-backfill" data-tone="warn">
          <span>
            <span className="font-bold">{formatJSTDate(targetDate, { month: 'long', day: 'numeric', weekday: 'short' })}</span>
            の記録を、あとから書いています
          </span>
          <button type="button" onClick={handleClearTargetDate} className="btn-quiet">
            今日に戻す
          </button>
        </div>
      )}

      {/* 問い */}
      <div key={`title-${stepIndex}`} className="ck-title animate-fade-in">
        <h1>{targetDate && step.id === 'state' ? 'その日の調子は？' : step.title}</h1>
        <p>{(mounted && getDailyDescription(step.id)) || step.description}</p>
      </div>

      {/* ステップの中身（方向付きアニメーション） */}
      <div key={stepIndex} className={`flex-1 flex flex-col ${direction === 'forward' ? 'animate-enter-right' : 'animate-enter-left'}`}>
        {step.id === 'state' && <StateStep />}
        {step.id === 'notes' && <NotesStep />}
      </div>

      {/* 操作（親指の届くところ）。メモが空なら、清書せずに気分だけで記録する */}
      <div className="ck-actions">
        {quickError && (
          <p className="ck-error" role="alert">
            {quickError}
          </p>
        )}
        {step.id === 'notes' && !hasText ? (
          <button type="button" onClick={handleQuickSave} disabled={quickSaving} className="btn btn-primary btn-block">
            {quickSaving ? '記録しています…' : '気分だけで記録する'}
          </button>
        ) : (
          <button type="button" onClick={handleNext} disabled={!canProceed || quickSaving} className="btn btn-primary btn-block">
            {step.id === 'state' ? (
              missing ? (
                <Wbr text={`${missing}を|選んでください`} />
              ) : (
                <>
                  次へ
                  <ArrowRightIcon size={18} className="btn-arrow" />
                </>
              )
            ) : (
              <>
                <PenIcon size={18} />
                日記に清書する
              </>
            )}
          </button>
        )}
        {step.id === 'state' && (
          <button type="button" onClick={handleQuickSave} disabled={!canProceed || quickSaving} className="btn-quiet">
            {quickSaving ? '記録しています…' : targetDate ? '気分だけで記録する' : '今日は気分だけで記録する'}
          </button>
        )}
        {step.id === 'notes' && (
          <p className="ck-hint">{hasText ? '書いた言葉のまま、読みやすく整えます' : '言葉は、あとから日記に書き足せます'}</p>
        )}
      </div>
    </div>
  )
}
