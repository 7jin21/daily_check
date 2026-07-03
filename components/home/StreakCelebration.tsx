'use client'

import { useEffect, useState } from 'react'
import { STORAGE_KEYS } from '@/lib/constants'

const MILESTONES: Record<number, string> = {
  3:   '3日連続！いいペースです 🔥',
  7:   '1週間連続達成！素晴らしい！ 🎉',
  14:  '2週間連続！習慣になってきましたね 🌟',
  30:  '1ヶ月連続達成！本当に凄い！ 🏆',
  50:  '50日連続！驚異的です！ 💫',
  60:  '60日連続！習慣が力になっています 🚀',
  80:  '80日連続！100日まであと少し ⛰️',
  100: '100日連続！あなたは伝説です！ 👑',
}

export default function StreakCelebration({ streak }: { streak: number }) {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const msg = MILESTONES[streak]
    if (!msg) return
    const key = `${STORAGE_KEYS.MILESTONE_PREFIX}${streak}`
    if (localStorage.getItem(key)) return
    localStorage.setItem(key, '1')
    setMessage(msg)
    const t = setTimeout(() => setMessage(null), 4500)
    return () => clearTimeout(t)
  }, [streak])

  if (!message) return null

  return (
    <div
      className="fixed top-safe left-1/2 z-50 animate-slide-up"
      style={{ transform: 'translateX(-50%)', top: 'calc(env(safe-area-inset-top) + 16px)' }}
    >
      <div className="px-6 py-3 rounded-[3px] bg-[#2a2622] text-[#f4efe6] font-semibold text-sm shadow-xl shadow-[rgba(42,38,34,0.3)] whitespace-nowrap border border-[var(--accent)]">
        {message}
      </div>
    </div>
  )
}
