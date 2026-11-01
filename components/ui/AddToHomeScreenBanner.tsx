'use client'

import { useState, useEffect } from 'react'
import { CloseIcon, MirrorMark, ShareIcon } from '@/components/ui/icons'

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
      className="fixed left-4 right-4 z-50 bg-[var(--surface)] rounded-2xl shadow-xl border border-[var(--border)] p-4"
      style={{ bottom: 'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 12px)' }}
    >
      <div className="flex items-start gap-3">
        <MirrorMark size={32} className="flex-shrink-0 text-[var(--gold)]" />
        <div className="flex-1 min-w-0">
          <p className="font-mincho font-semibold text-[var(--foreground)] text-sm">ホーム画面に置いておく</p>
          <p className="text-xs font-ui text-[var(--muted)] mt-1 leading-relaxed">
            Safari の
            <span className="inline-flex items-center gap-1 mx-1 align-middle bg-[var(--surface-secondary)] rounded-md px-1.5 py-0.5 text-[var(--foreground)]">
              <ShareIcon size={14} />
              共有
            </span>
            から「ホーム画面に追加」を選ぶと、アプリのように開けます
          </p>
        </div>
        <button type="button" onClick={dismiss} className="flex-shrink-0 -mr-2 -mt-2 text-[var(--muted)]" aria-label="閉じる">
          <CloseIcon size={18} />
        </button>
      </div>
    </div>
  )
}
