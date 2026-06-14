'use client'

interface Stats {
  total: number
  avgMood: number
  streak: number
}

interface StatsCardsProps {
  stats: Stats
}

const MOOD_EMOJI = ['', '😞', '😕', '😐', '🙂', '😄']

function streakStyle(streak: number): { bg: string; text: string; border: string } {
  if (streak >= 30) return {
    bg: 'bg-gradient-to-br from-violet-500/10 to-pink-500/10 dark:from-violet-500/20 dark:to-pink-500/20',
    text: 'text-violet-600 dark:text-violet-400',
    border: 'border-violet-200 dark:border-violet-700/50',
  }
  if (streak >= 7) return {
    bg: 'bg-gradient-to-br from-amber-400/10 to-orange-500/10 dark:from-amber-400/20 dark:to-orange-500/20',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-700/50',
  }
  if (streak >= 3) return {
    bg: 'bg-gradient-to-br from-orange-400/10 to-red-400/10 dark:from-orange-400/20 dark:to-red-400/20',
    text: 'text-orange-600 dark:text-orange-400',
    border: 'border-orange-200 dark:border-orange-700/50',
  }
  return {
    bg: 'bg-white dark:bg-slate-800',
    text: 'text-slate-800 dark:text-white',
    border: 'border-slate-100 dark:border-slate-700',
  }
}

export default function StatsCards({ stats }: StatsCardsProps) {
  const moodEmoji = MOOD_EMOJI[Math.round(stats.avgMood)] ?? '—'
  const ss = streakStyle(stats.streak)
  const streakIcon = stats.streak >= 30 ? '🏆' : stats.streak >= 7 ? '🔥' : stats.streak >= 3 ? '🔥' : '🔥'

  return (
    <div className="grid grid-cols-3 gap-3">
      {/* Streak — highlighted when high */}
      <div className={`rounded-3xl p-3 border text-center ${ss.bg} ${ss.border}`}>
        <div className="text-xl mb-1">{streakIcon}</div>
        <div className={`text-base font-bold ${ss.text}`}>
          {stats.streak ? `${stats.streak}日` : '0日'}
        </div>
        <div className="text-xs text-slate-400 mt-0.5">連続記録</div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-3xl p-3 border border-slate-100 dark:border-slate-700 text-center">
        <div className="text-xl mb-1">📖</div>
        <div className="text-base font-bold text-slate-800 dark:text-white">{stats.total}件</div>
        <div className="text-xs text-slate-400 mt-0.5">総記録数</div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-3xl p-3 border border-slate-100 dark:border-slate-700 text-center">
        <div className="text-xl mb-1">✨</div>
        <div className="text-base font-bold text-slate-800 dark:text-white">
          {stats.avgMood ? `${moodEmoji} ${stats.avgMood}` : '—'}
        </div>
        <div className="text-xs text-slate-400 mt-0.5">平均気分</div>
      </div>
    </div>
  )
}
