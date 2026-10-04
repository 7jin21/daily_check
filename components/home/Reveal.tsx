'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

// スクロールして画面に入ったら、ふわりと現れる（一度だけ）。
// 減らすモーション設定のときは CSS 側で最初から表示される。
export default function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          io.disconnect()
        }
      },
      { rootMargin: '0px 0px -12% 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={ref} className={`im-reveal ${className}`} data-visible={visible}>
      {children}
    </div>
  )
}
