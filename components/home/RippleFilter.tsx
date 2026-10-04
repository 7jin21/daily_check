'use client'

import { useEffect, useRef } from 'react'

// 水面の揺らぎ（SVG フィルター）。映り込みに filter: url(#im-ripple) で掛ける。
// SMIL アニメーションは CSS の prefers-reduced-motion では止まらないため、ここで明示的に止める。
// 画面外にある間も止めて、スクロール中の描画負荷を下げる。
export default function RippleFilter() {
  const ref = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const svg = ref.current
    if (!svg) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (reduce.matches) {
      svg.pauseAnimations()
      return
    }
    const hero = svg.closest('.im-mirror')
    if (!hero || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) svg.unpauseAnimations()
      else svg.pauseAnimations()
    })
    io.observe(hero)
    return () => io.disconnect()
  }, [])

  return (
    <svg ref={ref} width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
      <filter id="im-ripple" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.006 0.09" numOctaves="2" seed="7" result="noise">
          <animate
            attributeName="baseFrequency"
            dur="18s"
            values="0.006 0.09;0.009 0.12;0.006 0.09"
            repeatCount="indefinite"
          />
        </feTurbulence>
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="6" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  )
}
