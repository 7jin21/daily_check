import Link from 'next/link'

interface DayEntry {
  entry_date: string
  mood: number
  summary: string | null
}

interface Props {
  year: number
  month: number // 1-12
  entries: DayEntry[]
  todayJST: string
  prevHref: string
  nextHref: string | null // null = 今月より先には進めない
  todayHref: string | null // null = 既に今月を表示中
}

const MOOD_COLOR: Record<number, string> = {
  1: '#b5654a', 2: '#c5895f', 3: '#cdbf9a', 4: '#9caa7e', 5: '#6f8a5f',
}

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** today からの経過日数（正の値 = 過去）*/
function diffDaysFromToday(dateStr: string, todayJST: string): number {
  return Math.round((Date.parse(`${todayJST}T00:00:00Z`) - Date.parse(`${dateStr}T00:00:00Z`)) / 86_400_000)
}

export default function MonthCalendar({ year, month, entries, todayJST, prevHref, nextHref, todayHref }: Props) {
  const entryMap = new Map(entries.map((e) => [e.entry_date, e]))
  const recordedCount = entries.length

  const leadingBlanks = new Date(year, month - 1, 1).getDay() // 0=日
  const daysInMonth = new Date(year, month, 0).getDate()
  const weeksCount = Math.ceil((leadingBlanks + daysInMonth) / 7)

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' })

  return (
    <div>
      {/* 月ナビゲーション */}
      <div className="flex items-center justify-between mb-5">
        <Link
          href={prevHref}
          className="w-10 h-10 rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] flex items-center justify-center text-lg text-[var(--foreground)]"
          aria-label="前の月"
        >
          ‹
        </Link>
        <div className="text-center">
          <h2 className="text-base font-bold text-[var(--foreground)]">{monthLabel}</h2>
          {todayHref && (
            <Link href={todayHref} className="text-xs text-[var(--primary)] underline underline-offset-2">
              今月に戻る
            </Link>
          )}
        </div>
        {nextHref ? (
          <Link
            href={nextHref}
            className="w-10 h-10 rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] flex items-center justify-center text-lg text-[var(--foreground)]"
            aria-label="次の月"
          >
            ›
          </Link>
        ) : (
          <span
            className="w-10 h-10 rounded-full border border-[var(--border)] flex items-center justify-center text-lg text-[var(--muted-2)] opacity-40"
            aria-hidden="true"
          >
            ›
          </span>
        )}
      </div>

      {/* 曜日ヘッダー */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="text-center text-[11px] text-[var(--muted-2)] py-1">
            {label}
          </div>
        ))}
      </div>

      {/* 日付グリッド */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: weeksCount * 7 }, (_, cellIndex) => {
          const dayNum = cellIndex - leadingBlanks + 1
          if (dayNum < 1 || dayNum > daysInMonth) {
            return <div key={cellIndex} />
          }

          const dateStr = `${year}-${pad2(month)}-${pad2(dayNum)}`
          const entry = entryMap.get(dateStr)
          const isToday = dateStr === todayJST
          const isFuture = dateStr > todayJST
          const diffDays = diffDaysFromToday(dateStr, todayJST)
          const backfillable = !entry && !isFuture && !isToday && diffDays > 0 && diffDays <= 7

          let href: string | null = null
          if (entry) href = `/entries/${dateStr}`
          else if (isToday) href = '/checkin'
          else if (backfillable) href = `/checkin?date=${dateStr}`

          const cellContent = (
            <div className="flex flex-col items-center justify-center gap-1 w-full h-full">
              <span
                className="text-[13px] leading-none"
                style={{ color: isFuture ? 'var(--muted-2)' : 'var(--foreground)', fontWeight: isToday ? 700 : 500 }}
              >
                {dayNum}
              </span>
              {entry ? (
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: MOOD_COLOR[entry.mood] ?? '#cdbf9a' }}
                />
              ) : backfillable ? (
                <span className="text-[10px] leading-none text-[var(--muted-2)]">+</span>
              ) : (
                <span className="w-2 h-2" />
              )}
            </div>
          )

          const baseClass = 'aspect-square rounded-2xl flex items-center justify-center'
          const style: React.CSSProperties = entry
            ? { backgroundColor: `${MOOD_COLOR[entry.mood] ?? '#cdbf9a'}1f` }
            : isToday
              ? { border: '1.5px dashed var(--primary)' }
              : backfillable
                ? { border: '1px dashed var(--border)' }
                : {}

          if (href) {
            return (
              <Link
                key={cellIndex}
                href={href}
                className={`${baseClass} active:opacity-70 transition-opacity`}
                style={style}
                title={entry?.summary ?? undefined}
              >
                {cellContent}
              </Link>
            )
          }

          return (
            <div key={cellIndex} className={`${baseClass} opacity-50`} style={style}>
              {cellContent}
            </div>
          )
        })}
      </div>

      {/* 凡例 */}
      <div className="flex items-center justify-between mt-5">
        <span className="text-[11px] text-[var(--muted)]">
          この月は <span className="font-bold text-[var(--foreground)]">{recordedCount}日</span> 記録
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-[var(--muted-2)]">悪</span>
          {[1, 2, 3, 4, 5].map((m) => (
            <div key={m} style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: MOOD_COLOR[m] }} />
          ))}
          <span className="text-[10px] text-[var(--muted-2)]">良</span>
        </div>
      </div>
    </div>
  )
}
