'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

interface Entry {
  entry_date: string
  mood: number
  energy: number
}

interface MoodChartProps {
  entries: Entry[]
}

export default function MoodChart({ entries }: MoodChartProps) {
  const data = [...entries]
    .sort((a, b) => a.entry_date.localeCompare(b.entry_date))
    .slice(-14)
    .map((e) => ({
      date: e.entry_date.slice(5),  // "MM-DD"
      気分: e.mood,
      エネルギー: e.energy,
    }))

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
        記録が溜まるとここにグラフが表示されます
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
        <defs>
          <linearGradient id="moodGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="energyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.4} />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
        <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{
            borderRadius: 12,
            border: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        <Area type="monotone" dataKey="気分" stroke="#38bdf8" fill="url(#moodGrad)" strokeWidth={2} dot={false} />
        <Area type="monotone" dataKey="エネルギー" stroke="#a78bfa" fill="url(#energyGrad)" strokeWidth={2} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
