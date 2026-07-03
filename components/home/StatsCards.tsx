'use client'

interface Stats {
  total: number
  avgMood: number
  streak: number
}

interface StatsCardsProps {
  stats: Stats
}

// モック準拠: 縦型カード3枚。丸いアイコンチップ（セージ/ゴールド/ブルー）＋
// ラベル＋大きなセリフ数字。背景はそれぞれ淡い色味＋植物モチーフの線画。

export default function StatsCards({ stats }: StatsCardsProps) {
  const cells = [
    {
      label: '連続記録',
      value: String(stats.streak ?? 0),
      unit: '日',
      chip: '#6b8756',
      tint: 'rgba(107,135,86,0.13)',
      icon: <SproutIcon />,
      art: <LeafArt />,
    },
    {
      label: '総記録数',
      value: String(stats.total ?? 0),
      unit: '件',
      chip: '#ab8b4e',
      tint: 'rgba(171,139,78,0.13)',
      icon: <BookIcon />,
      art: <PagesArt />,
    },
    {
      label: '平均気分',
      value: stats.avgMood ? String(stats.avgMood) : '—',
      unit: '/ 5',
      chip: '#8ba3b5',
      tint: 'rgba(139,163,181,0.16)',
      icon: <SmileIcon />,
      art: <CloudArt />,
    },
  ]

  return (
    <div className="grid grid-cols-3 gap-3">
      {cells.map((c) => (
        <div
          key={c.label}
          className="relative overflow-hidden rounded-[20px] border border-[var(--border)] shadow-[0_8px_24px_rgba(72,70,52,0.08)] px-2 pt-5 pb-6 flex flex-col items-center text-center"
          style={{ background: `linear-gradient(170deg, ${c.tint} 0%, rgba(0,0,0,0) 70%), var(--surface)` }}
        >
          {/* 背景の装飾モチーフ */}
          <span className="absolute bottom-1 right-1 opacity-60 pointer-events-none">{c.art}</span>

          {/* アイコンチップ */}
          <span
            className="w-11 h-11 rounded-full flex items-center justify-center text-white shadow-md"
            style={{ backgroundColor: c.chip }}
          >
            {c.icon}
          </span>

          <span className="mt-3 text-[13px] text-[var(--foreground)] tracking-wide">{c.label}</span>

          <span className="mt-1.5 flex items-baseline gap-1">
            <span className="font-bold leading-none tracking-tight text-[var(--foreground)]" style={{ fontSize: 32 }}>
              {c.value}
            </span>
            <span className="text-xs text-[var(--muted)]">{c.unit}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

/* ─── アイコン（白線画） ─── */

function SproutIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20 v-7" />
      <path d="M12 13 C12 9 9 6 4 6 C4 10 7 13 12 13 Z" />
      <path d="M12 11 C12 7.5 15 5 20 5 C20 8.5 16.5 11 12 11 Z" />
    </svg>
  )
}

function BookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5 C7 3.8 10 3.8 12 5.2 C14 3.8 17 3.8 20 5 V18.6 C17 17.4 14 17.4 12 18.8 C10 17.4 7 17.4 4 18.6 Z" />
      <line x1="12" y1="5.2" x2="12" y2="18.8" />
    </svg>
  )
}

function SmileIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 13.5 C9.5 15.2 10.6 16 12 16 C13.4 16 14.5 15.2 15.5 13.5" />
      <circle cx="9.2" cy="10" r="0.6" fill="currentColor" />
      <circle cx="14.8" cy="10" r="0.6" fill="currentColor" />
    </svg>
  )
}

/* ─── 背景モチーフ（淡い線画） ─── */

function LeafArt() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden="true">
      <path d="M10 40 C12 28 18 20 32 14 C30 26 22 36 10 40 Z" stroke="#6b8756" strokeWidth="1.2" opacity="0.5" />
      <path d="M10 40 C16 32 24 22 32 14" stroke="#6b8756" strokeWidth="0.9" opacity="0.4" />
    </svg>
  )
}

function PagesArt() {
  return (
    <svg width="46" height="42" viewBox="0 0 46 42" fill="none" aria-hidden="true">
      <g stroke="#ab8b4e" strokeWidth="1.1" opacity="0.45">
        <path d="M8 36 C14 30 24 28 38 30" />
        <path d="M10 30 C16 24 26 22 40 24" />
        <path d="M12 24 C18 18 28 16 42 18" />
      </g>
    </svg>
  )
}

function CloudArt() {
  return (
    <svg width="48" height="36" viewBox="0 0 48 36" fill="none" aria-hidden="true">
      <g stroke="#8ba3b5" strokeWidth="1.2" opacity="0.5">
        <path d="M8 30 C8 24 13 21 17 22 C18 17 24 15 28 18 C31 15 38 16 39 22 C43 22 45 26 44 30 Z" />
        <path d="M14 12 C14 9 17 7.5 19 8.5" />
      </g>
    </svg>
  )
}
