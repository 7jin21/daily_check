import Link from 'next/link'
import { MirrorMark } from '@/components/ui/icons'

export default function NotFound() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
      <MirrorMark size={56} className="empty-mark" />
      <h1 className="font-mincho text-xl font-semibold tracking-wide text-[var(--foreground)]">ページが見つかりません</h1>
      <p className="text-sm font-ui text-[var(--muted)] mt-3 max-w-xs leading-relaxed">
        お探しのページは存在しないか、移動した可能性があります。
      </p>
      <Link href="/" className="btn btn-primary mt-8 w-full max-w-xs">
        ホームに戻る
      </Link>
    </div>
  )
}
