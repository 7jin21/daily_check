// インサイト画面の複数のセクションで使う、表示用の小さな部品
import InkRings from '@/components/ui/InkRings'

/** キャッシュした結果がどれくらい前に作られたか（「3時間前」など） */
export function formatAge(ts: number) {
  const m = Math.floor((Date.now() - ts) / 60000)
  if (m < 1) return 'たった今'
  if (m < 60) return `${m}分前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}時間前`
  return `${Math.floor(h / 24)}日前`
}

/** AI への依頼が失敗したときに出す一文（時間切れで止めたときは、もう一度を促す） */
export function requestError(request: { signal: AbortSignal }, err: unknown, fallback: string): string {
  if (request.signal.aborted) return '時間がかかっています。もう一度お試しください'
  return err instanceof Error ? err.message : fallback
}

/** セクションの見出し。右上に控えめな操作（作る・更新する）と、表示中の結果がいつのものかを添える */
export function SectionHeader({ title, actionLabel, busy, cachedAt, onAction }: {
  title: string
  actionLabel: string
  busy: boolean
  cachedAt: number | null
  onAction: () => void
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="font-mincho text-lg font-semibold tracking-wide text-[var(--foreground)]">{title}</h2>
      <div className="flex flex-col items-end gap-0.5">
        <button
          type="button"
          onClick={onAction}
          disabled={busy}
          className="btn-quiet"
          style={{ minHeight: 32, color: 'var(--primary)', fontWeight: 700 }}
        >
          {actionLabel}
        </button>
        {cachedAt && !busy && (
          <span className="text-xs text-[var(--muted-2)]">{formatAge(cachedAt)}</span>
        )}
      </div>
    </div>
  )
}

/** AI が日記を読んでいる間の表示（墨の輪）。上下の余白（py-*）はセクションの高さに合わせて渡す */
export function ReadingBlock({ message, className }: { message: string; className: string }) {
  return (
    <div className={`flex flex-col items-center justify-center ${className} gap-5`} role="status">
      <InkRings size="md" />
      <p className="font-mincho text-[var(--muted)] text-sm tracking-wide">{message}</p>
    </div>
  )
}
