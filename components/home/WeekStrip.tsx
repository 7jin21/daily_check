'use client'

interface Entry {
  entry_date: string
  mood: number
}

const MOOD_COLOR = ['', '#b5654a', '#c5895f', '#cdbf9a', '#9caa7e', '#6f8a5f']
const DAY_LABELS = ['月', '火', '水', '木', '金', '土', '日']

export default function WeekStrip({ entries }: { entries: Entry[] }) {
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
  const entryMap = new Map(entries.map((e) => [e.entry_date, e.mood]))

  // Monday of this week (JST)
  const todayJST = new Date(todayStr + 'T12:00:00+09:00')
  const dow = todayJST.getDay() // 0=Sun
  const mondayOffset = dow === 0 ? -6 : 1 - dow

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(todayJST)
    d.setDate(todayJST.getDate() + mondayOffset + i)
    return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
  })

  return (
    <div className="flex justify-between">
      {weekDates.map((date, i) => {
        const mood = entryMap.get(date) ?? null
        const isToday = date === todayStr
        const isFuture = date > todayStr

        let bgStyle: React.CSSProperties = {}
        let extraClass = ''

        if (isFuture) {
          extraClass = 'border border-dashed border-[var(--border)]'
        } else if (mood !== null) {
          bgStyle = { backgroundColor: MOOD_COLOR[mood] }
        } else {
          bgStyle = { backgroundColor: 'var(--surface-secondary)', border: '1px solid var(--border)' }
        }

        return (
          <div key={date} className="flex flex-col items-center gap-3">
            <span
              className={`text-xs tracking-wide ${
                isToday ? 'text-[var(--primary)] font-bold' : 'text-[var(--muted)]'
              }`}
            >
              {DAY_LABELS[i]}
            </span>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                boxShadow: isToday ? '0 0 0 2px var(--primary)' : undefined,
                ...bgStyle,
              }}
              className={['flex items-center justify-center flex-shrink-0', extraClass]
                .filter(Boolean)
                .join(' ')}
            >
              {isToday && mood === null && (
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] block" />
              )}
            </div>
            <span className="text-[10px] tracking-wide text-[var(--muted-2)]">
              {isToday ? '今日' : ' '}
            </span>
          </div>
        )
      })}
    </div>
  )
}
