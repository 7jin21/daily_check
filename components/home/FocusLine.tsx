'use client'

import { useEffect, useState } from 'react'
import { doneInLastWeek, isFocusActive, loadFocus, saveFocus, toggleDone, type Focus } from '@/lib/focus'
import { subtractDays } from '@/lib/home-model'
import { hapticTap } from '@/lib/haptics'
import Reveal from './Reveal'

// 週次レポートで採用した「今週のフォーカス」と、今日やったかのワンタップ記録
export default function FocusLine({ today }: { today: string }) {
  const [focus, setFocus] = useState<Focus | null>(null)

  useEffect(() => {
    const f = loadFocus()
    if (isFocusActive(f, today)) setFocus(f)
  }, [today])

  if (!focus) return null

  const doneToday = focus.doneDates.includes(today)
  const days = Array.from({ length: 7 }, (_, i) => subtractDays(today, 6 - i))
  const count = doneInLastWeek(focus, today)

  const toggle = () => {
    hapticTap()
    const next = toggleDone(focus, today)
    saveFocus(next)
    setFocus(next)
  }

  return (
    <Reveal className="im-section">
      <div className="im-focus">
        <div className="im-label">今週のフォーカス</div>
        <p className="im-focus-text">{focus.text}</p>
        <div className="im-focus-row">
          <span className="im-focus-days" role="img" aria-label={`直近7日のうち${count}日できた`}>
            {days.map((d) => (
              <i key={d} data-done={focus.doneDates.includes(d)} data-today={d === today} />
            ))}
          </span>
          <button type="button" className="im-focus-btn" data-done={doneToday} aria-pressed={doneToday} onClick={toggle}>
            {doneToday ? '✓ 今日できた' : '今日やった'}
          </button>
        </div>
      </div>
    </Reveal>
  )
}
