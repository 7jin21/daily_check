import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
      <div className="text-6xl mb-5">🔍</div>
      <h1 className="text-xl font-bold text-slate-900 dark:text-white">ページが見つかりません</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-xs leading-relaxed">
        お探しのページは存在しないか、移動した可能性があります。
      </p>
      <Link
        href="/"
        className="mt-8 w-full max-w-xs py-3.5 rounded-3xl animated-gradient text-white font-bold text-center active:scale-95 transition-transform"
      >
        ホームに戻る
      </Link>
    </div>
  )
}
