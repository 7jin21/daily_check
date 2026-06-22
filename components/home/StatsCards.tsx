'use client'

interface Stats {
  total: number
  avgMood: number
  streak: number
}

interface StatsCardsProps {
  stats: Stats
}

interface Cell {
  label: string
  value: string
  unit: string
  accent?: boolean
}

export default function StatsCards({ stats }: StatsCardsProps) {
  const cells: Cell[] = [
    { label: '連続記録', value: String(stats.streak ?? 0), unit: '日' },
    { label: '総記録数', value: String(stats.total ?? 0), unit: '件' },
    { label: '平均気分', value: stats.avgMood ? String(stats.avgMood) : '—', unit: '/ 5', accent: true },
  ]

  return (
    <div className="grid grid-cols-3 gap-3">
      {cells.map((c) => (
        <div key={c.label} className="card" style={{ padding: '20px 16px' }}>
          <div className="text-[10px] tracking-[0.16em] uppercase text-[var(--muted)]">{c.label}</div>
          <div className="flex items-baseline gap-1 mt-3">
            <span
              className="font-bold leading-[0.9] tracking-tight"
              style={{ fontSize: 34, color: c.accent ? 'var(--primary)' : 'var(--foreground)' }}
            >
              {c.value}
            </span>
            <span className="text-xs text-[var(--muted)]">{c.unit}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
