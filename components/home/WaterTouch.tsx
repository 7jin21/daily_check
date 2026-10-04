'use client'

import { useRef, type PointerEvent } from 'react'

// 水面に触れると、そこから波紋が広がる（ささやかな手ざわり）。
// 波紋は DOM に直接足して、アニメーションが終わったら消す（React の再描画を起こさない）。
export default function WaterTouch() {
  const ref = useRef<HTMLDivElement>(null)

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const host = ref.current
    if (!host || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const rect = host.getBoundingClientRect()
    for (let i = 0; i < 2; i++) {
      const ring = document.createElement('span')
      ring.className = 'im-ripple'
      ring.style.left = `${e.clientX - rect.left}px`
      ring.style.top = `${e.clientY - rect.top}px`
      ring.style.animationDelay = `${i * 0.22}s`
      ring.addEventListener('animationend', () => ring.remove())
      host.appendChild(ring)
    }
  }

  return <div ref={ref} className="im-touch" onPointerDown={onPointerDown} aria-hidden="true" />
}
