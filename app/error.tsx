'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('App error:', error)
  }, [error])

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
      <div className="text-6xl mb-5 animate-float">🪞</div>
      <h1 className="text-xl font-bold text-[var(--foreground)]">問題が発生しました</h1>
      <p className="text-sm text-[var(--muted)] mt-2 max-w-xs leading-relaxed">
        一時的なエラーの可能性があります。もう一度お試しください。
      </p>
      <div className="w-full max-w-xs mt-8 space-y-3">
        <button
          onClick={reset}
          className="w-full py-3.5 rounded-[2px] bg-[var(--accent)] text-[#2a2622] font-bold active:scale-[0.99] transition-transform"
        >
          もう一度試す
        </button>
        <Link
          href="/"
          className="block w-full py-3 rounded-[2px] border border-[var(--border)] text-[var(--muted)] text-sm active:scale-95 transition-transform"
        >
          ホームに戻る
        </Link>
      </div>
    </div>
  )
}
