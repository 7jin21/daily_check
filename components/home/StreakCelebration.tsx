'use client'

import { useEffect, useState } from 'react'
import { STORAGE_KEYS } from '@/lib/constants'

const MILESTONES: Record<number, string> = {
  3: '三日、続きました。',
  7: '一週間、続きました。',
  14: '二週間。もう習慣になっています。',
  30: 'ひと月、毎日映してきました。',
  50: '五十日。積み重ねが形になってきました。',
  60: '六十日。続けることが力になっています。',
  80: '八十日。百日まで、あと少し。',
  100: '百日。ここまでの自分を誇ってください。',
}

// 連続記録の節目に、ヒーローの上へ静かに現れる知らせ（同じ節目は一度だけ）
export default function StreakCelebration({ streak }: { streak: number }) {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const msg = MILESTONES[streak]
    if (!msg) return
    const key = `${STORAGE_KEYS.MILESTONE_PREFIX}${streak}`
    try {
      if (localStorage.getItem(key)) return
      localStorage.setItem(key, '1')
    } catch {
      return
    }
    setMessage(msg)
    const t = setTimeout(() => setMessage(null), 5200)
    return () => clearTimeout(t)
  }, [streak])

  if (!message) return null

  return (
    <div className="im-toast" role="status">
      <span className="im-toast-mark" aria-hidden="true">✦</span>
      <span className="im-toast-count">{streak}</span>
      <span className="im-toast-text">{message}</span>
    </div>
  )
}
