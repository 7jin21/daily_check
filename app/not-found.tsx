import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
      <div className="text-6xl mb-5">🔍</div>
      <h1 className="text-xl font-bold text-[var(--foreground)]">ページが見つかりません</h1>
      <p className="text-sm text-[var(--muted)] mt-2 max-w-xs leading-relaxed">
        お探しのページは存在しないか、移動した可能性があります。
      </p>
      <Link
        href="/"
        className="mt-8 w-full max-w-xs py-3.5 rounded-full bg-[var(--accent)] text-[#f7f4ea] font-bold text-center active:scale-[0.99] transition-transform"
      >
        ホームに戻る
      </Link>
    </div>
  )
}
