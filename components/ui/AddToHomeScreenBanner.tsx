'use client'

import { useState, useEffect } from 'react'

const DISMISSED_KEY = 'pwa-banner-dismissed'

export default function AddToHomeScreenBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    const dismissed = localStorage.getItem(DISMISSED_KEY)

    if (isIOS && !isStandalone && !dismissed) {
      setShow(true)
    }
  }, [])

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1')
    setShow(false)
  }

  if (!show) return null

  return (
    <div
      className="fixed left-4 right-4 z-50 bg-[var(--surface)] rounded-[3px] shadow-xl border border-[var(--border)] p-4"
      style={{ bottom: 'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 12px)' }}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0">📲</span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[var(--foreground)] text-sm">ホーム画面に追加する</p>
          <p className="text-xs text-[var(--muted)] mt-1 leading-relaxed">
            Safariの下部メニューから
            <span className="inline-flex items-center gap-1 mx-1 bg-[var(--surface-secondary)] rounded px-1 py-0.5 text-[var(--foreground)]">
              共有 □↑
            </span>
            をタップ → 「ホーム画面に追加」を選択
          </p>
        </div>
        <button
          onClick={dismiss}
          className="w-6 h-6 flex items-center justify-center text-[var(--muted-2)] flex-shrink-0 text-lg"
          aria-label="閉じる"
        >
          ×
        </button>
      </div>
    </div>
  )
}
