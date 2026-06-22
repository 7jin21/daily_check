'use client'

interface Entry {
  entry_date: string
  mood: number
}

interface CalendarHeatmapProps {
  entries: Entry[]
}

// mood 1-5 → color; index 0 unused（アース系）
const MOOD_COLOR = ['', '#b5654a', '#c5895f', '#cdbf9a', '#9caa7e', '#6f8a5f']

function subtractDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const t = new Date(y, m - 1, d - n)
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

export default function CalendarHeatmap({ entries }: CalendarHeatmapProps) {
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
  const entryMap = new Map(entries.map((e) => [e.entry_date, e.mood]))

  // Start of the 13-week grid: Sunday of the week 12 full weeks before today's week
  const todayJST = new Date(todayStr + 'T12:00:00+09:00')
  const dow = todayJST.getDay() // 0=Sun … 6=Sat
  const startDate = new Date(todayJST)
  startDate.setDate(todayJST.getDate() - dow - 12 * 7)

  type Cell = { date: string; mood: number | null; isFuture: boolean }
  const weeks: Cell[][] = []
  const monthLabelByWeek: string[] = Array(13).fill('')

  for (let w = 0; w < 13; w++) {
    const week: Cell[] = []
    for (let d = 0; d < 7; d++) {
      const cur = new Date(startDate)
      cur.setDate(startDate.getDate() + w * 7 + d)
      const dateStr = cur.toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
      if (cur.getDate() === 1 && !monthLabelByWeek[w]) {
        monthLabelByWeek[w] = `${cur.getMonth() + 1}月`
      }
      const isFuture = dateStr > todayStr
      week.push({ date: dateStr, mood: isFuture ? null : (entryMap.get(dateStr) ?? null), isFuture })
    }
    weeks.push(week)
  }

  const recorded90 = Array.from(entryMap.keys()).filter((d) => d >= subtractDays(todayStr, 90)).length

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: 260 }}>
        {/* Month labels */}
        <div className="flex mb-1" style={{ paddingLeft: 22 }}>
          {weeks.map((_, wi) => (
            <div
              key={wi}
              style={{ width: 14, marginRight: 2, flexShrink: 0 }}
              className="text-[9px] text-[var(--muted-2)] leading-none"
            >
              {monthLabelByWeek[wi]}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="flex">
          {/* Day-of-week labels (Mon, Wed, Fri) */}
          <div className="flex flex-col" style={{ width: 20, marginRight: 2, flexShrink: 0 }}>
            {['日', '月', '火', '水', '木', '金', '土'].map((label, i) => (
              <div
                key={label}
                style={{ height: 14, marginBottom: 2 }}
                className="text-[9px] text-[var(--muted-2)] flex items-center justify-end pr-0.5"
              >
                {[1, 3, 5].includes(i) ? label : ''}
              </div>
            ))}
          </div>

          {/* Week columns */}
          <div className="flex" style={{ gap: 2 }}>
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col" style={{ gap: 2 }}>
                {week.map((cell, di) => (
                  <div
                    key={di}
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 3,
                      flexShrink: 0,
                      backgroundColor: cell.isFuture
                        ? 'transparent'
                        : cell.mood !== null
                          ? MOOD_COLOR[cell.mood]
                          : undefined,
                    }}
                    className={
                      !cell.isFuture && cell.mood === null
                        ? 'bg-[var(--surface-secondary)]'
                        : ''
                    }
                    title={
                      !cell.isFuture
                        ? cell.mood
                          ? `${cell.date} 気分:${cell.mood}`
                          : cell.date
                        : undefined
                    }
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between mt-4">
          <span className="text-[11px] text-[var(--muted)]">
            直近90日で <span className="font-bold text-[var(--foreground)]">{recorded90}日</span> 記録
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[var(--muted-2)]">悪</span>
            {[1, 2, 3, 4, 5].map((m) => (
              <div
                key={m}
                style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: MOOD_COLOR[m] }}
              />
            ))}
            <span className="text-[10px] text-[var(--muted-2)]">良</span>
          </div>
        </div>
      </div>
    </div>
  )
}
