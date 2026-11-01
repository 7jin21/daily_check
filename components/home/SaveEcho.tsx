'use client'

import { useEffect } from 'react'
import { takeSaveEcho } from '@/lib/save-echo'

// 保存した直後にホームへ戻ってきたときの「余韻」。保存画面で水面に落ちた一滴の続き。
// - 今日の記録なら、ヒーローの水面に、その日の気分の色の波紋を広げる
// - 「この一週間」の、書いた日の丸に色が落ちる（丸が見えたときに一度だけ）
// DOM に直接印を付けるだけで、React の再描画は起こさない。
export default function SaveEcho({ today }: { today: string }) {
  useEffect(() => {
    const echo = takeSaveEcho()
    if (!echo) return

    const dot = document.querySelector<HTMLElement>(`.im-day[data-date="${echo.date}"] .im-day-dot`)
    if (dot) dot.dataset.landing = 'true'

    if (echo.date !== today || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const host = document.querySelector<HTMLElement>('.im-mirror .im-touch')
    if (!host) return
    // 画面を離れても、残った輪はアニメーションの終わりに自分で消える（後片付けのタイマーは持たない）
    ;[0, 320, 640].forEach((delay) => {
      window.setTimeout(() => {
        const ring = document.createElement('span')
        ring.className = 'im-ripple im-ripple-echo'
        ring.style.left = '50%'
        ring.style.top = '34%'
        ring.style.borderColor = `var(--mood-${echo.mood})`
        ring.addEventListener('animationend', () => ring.remove())
        host.appendChild(ring)
      }, 650 + delay)
    })
  }, [today])

  return null
}
