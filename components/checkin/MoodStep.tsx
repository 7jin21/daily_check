'use client'

import { MOODS } from '@/lib/constants'
import { useCheckinStore } from '@/stores/checkin'
import { hapticTap } from '@/lib/haptics'

export default function MoodStep() {
  const { mood, setMood } = useCheckinStore()

  const handleSelect = (value: number) => {
    hapticTap()
    setMood(value)
  }

  return (
    <div className="grid grid-cols-5 gap-3">
      {MOODS.map((m) => (
        <button
          key={m.value}
          onClick={() => handleSelect(m.value)}
          className={`
            flex flex-col items-center gap-2 p-3 rounded-3xl border-2 transition-all duration-150 active:scale-95
            ${mood === m.value
              ? 'border-sky-400 bg-sky-50 dark:bg-sky-900/30 scale-105'
              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
            }
          `}
          style={mood === m.value ? { borderColor: m.color } : {}}
          aria-label={m.label}
          aria-pressed={mood === m.value}
        >
          {/* key を切り替えて選択のたびにポップアニメーションを再生 */}
          <span
            key={mood === m.value ? 'selected' : 'idle'}
            className={`text-3xl ${mood === m.value ? 'animate-pop' : ''}`}
          >
            {m.emoji}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 text-center leading-tight">
            {m.label}
          </span>
        </button>
      ))}
    </div>
  )
}
