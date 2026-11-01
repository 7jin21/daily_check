import Link from 'next/link'
import { daysBetween } from '@/lib/jst'
import { MOODS, moodColor, moodLabel } from '@/lib/constants'
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from '@/components/ui/icons'

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

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

function pad2(n: number): string {
  return String(n).padStart(2, '0')
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
        <Link href={prevHref} className="icon-btn" aria-label="前の月">
          <ChevronLeftIcon size={20} />
        </Link>
        <div className="text-center">
          <h2 className="font-mincho text-lg font-semibold tracking-wider text-[var(--foreground)]">{monthLabel}</h2>
          {todayHref && (
            <Link href={todayHref} className="btn-quiet" style={{ minHeight: 32, color: 'var(--primary)' }}>
              今月に戻る
            </Link>
          )}
        </div>
        {nextHref ? (
          <Link href={nextHref} className="icon-btn" aria-label="次の月">
            <ChevronRightIcon size={20} />
          </Link>
        ) : (
          <span className="icon-btn opacity-40" aria-hidden="true">
            <ChevronRightIcon size={20} />
          </span>
        )}
      </div>

      {/* 曜日ヘッダー */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="text-center text-[0.6875rem] font-ui text-[var(--muted-2)] py-1">
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
          // today からの経過日数（正の値 = 過去）
          const diffDays = daysBetween(dateStr, todayJST)
          const backfillable = !entry && !isFuture && !isToday && diffDays > 0 && diffDays <= 7

          let href: string | null = null
          if (entry) href = `/entries/${dateStr}`
          else if (isToday) href = '/checkin'
          else if (backfillable) href = `/checkin?date=${dateStr}`

          const cellContent = (
            <div className="flex flex-col items-center justify-center gap-1 w-full h-full">
              <span
                className="text-[0.8125rem] leading-none font-display"
                style={{ color: isFuture ? 'var(--muted-2)' : 'var(--foreground)', fontWeight: isToday ? 700 : 500 }}
              >
                {dayNum}
              </span>
              {entry ? (
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: moodColor(entry.mood) }} />
              ) : backfillable ? (
                <PlusIcon size={10} strokeWidth={2} className="text-[var(--muted-2)]" />
              ) : (
                <span className="w-2 h-2" />
              )}
            </div>
          )

          const baseClass = 'aspect-square rounded-2xl flex items-center justify-center'
          const style: React.CSSProperties = entry
            ? { backgroundColor: `color-mix(in srgb, ${moodColor(entry.mood)} 14%, transparent)` }
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
                aria-label={`${month}月${dayNum}日${entry ? `（気分 ${moodLabel(entry.mood) ?? '—'}）` : isToday ? '（今日の記録をする）' : '（あとから書く）'}`}
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
        <span className="text-[0.6875rem] font-ui text-[var(--muted)]">
          この月は <span className="font-bold text-[var(--foreground)]">{recordedCount}日</span> 記録
        </span>
        <div className="flex items-center gap-1.5" aria-hidden="true">
          <span className="text-[0.625rem] font-ui text-[var(--muted-2)]">沈む</span>
          {MOODS.map((m) => (
            <div key={m.value} style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: m.color }} />
          ))}
          <span className="text-[0.625rem] font-ui text-[var(--muted-2)]">晴れる</span>
        </div>
      </div>
    </div>
  )
}
