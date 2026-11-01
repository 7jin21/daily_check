'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { MirrorMark } from '@/components/ui/icons'

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
      <MirrorMark size={56} className="empty-mark" />
      <h1 className="font-mincho text-xl font-semibold tracking-wide text-[var(--foreground)]">うまく表示できませんでした</h1>
      <p className="text-sm font-ui text-[var(--muted)] mt-3 max-w-xs leading-relaxed">
        一時的な不具合かもしれません。少し待ってから、もう一度お試しください。
      </p>
      <div className="w-full max-w-xs mt-8 space-y-3">
        <button type="button" onClick={reset} className="btn btn-primary btn-block">
          もう一度試す
        </button>
        <Link href="/" className="btn btn-secondary btn-block">
          ホームに戻る
        </Link>
      </div>
    </div>
  )
}
