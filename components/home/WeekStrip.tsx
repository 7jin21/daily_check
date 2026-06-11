'use client'

interface Entry {
  entry_date: string
  mood: number
}

const MOOD_COLOR = ['', '#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e']
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
          extraClass = 'border-2 border-dashed border-slate-200 dark:border-slate-700'
        } else if (mood !== null) {
          bgStyle = { backgroundColor: MOOD_COLOR[mood] }
        } else {
          extraClass = 'bg-slate-100 dark:bg-slate-700/60'
        }

        return (
          <div key={date} className="flex flex-col items-center gap-1.5">
            <span
              className={`text-xs font-medium ${
                isToday ? 'text-sky-500' : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              {DAY_LABELS[i]}
            </span>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                ...bgStyle,
              }}
              className={[
                'flex items-center justify-center flex-shrink-0',
                extraClass,
                isToday ? 'ring-2 ring-sky-400 ring-offset-2 dark:ring-offset-slate-900' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {isToday && mood === null && (
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 block" />
              )}
            </div>
            <span className="text-[10px] text-slate-300 dark:text-slate-600">
              {isToday ? '今日' : ' '}
            </span>
          </div>
        )
      })}
    </div>
  )
}
