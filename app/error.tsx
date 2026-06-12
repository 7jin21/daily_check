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
      <h1 className="text-xl font-bold text-slate-900 dark:text-white">問題が発生しました</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-xs leading-relaxed">
        一時的なエラーの可能性があります。もう一度お試しください。
      </p>
      <div className="w-full max-w-xs mt-8 space-y-3">
        <button
          onClick={reset}
          className="w-full py-3.5 rounded-2xl animated-gradient text-white font-bold active:scale-95 transition-transform"
        >
          もう一度試す
        </button>
        <Link
          href="/"
          className="block w-full py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-sm active:scale-95 transition-transform"
        >
          ホームに戻る
        </Link>
      </div>
    </div>
  )
}
