'use client'

import { useEffect, useState } from 'react'

const COLORS = ['#c89a6a', '#9c6b4a', '#6f8a5f', '#9caa7e', '#cdbf9a', '#c5895f', '#2a2622']

// 疑似ランダムだが決定論的な紙吹雪データ（SSRフラッシュなし）
const PIECES = Array.from({ length: 42 }, (_, i) => ({
  id: i,
  left: (i * 2.381 * 100) % 100,
  color: COLORS[i % COLORS.length],
  delay: ((i * 67) % 700) / 1000,
  duration: 1.1 + ((i * 43) % 900) / 1000,
  size: 5 + (i % 4) * 2,
  isCircle: i % 3 !== 0,
  initialRotate: (i * 47) % 360,
}))

export default function Confetti() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(true)
    const timer = setTimeout(() => setVisible(false), 2500)
    return () => clearTimeout(timer)
  }, [])

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden z-50"
      aria-hidden="true"
    >
      {PIECES.map((p) => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            top: '-12px',
            width: p.size,
            height: p.isCircle ? p.size : p.size * 1.8,
            borderRadius: p.isCircle ? '50%' : '3px',
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `rotate(${p.initialRotate}deg)`,
          }}
        />
      ))}
    </div>
  )
}
