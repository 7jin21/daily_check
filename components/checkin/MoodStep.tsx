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
            flex flex-col items-center gap-2 p-3 rounded-[3px] border transition-all duration-150 active:scale-95
            ${mood === m.value
              ? 'scale-105'
              : 'border-[var(--border)] bg-[var(--surface)]'
            }
          `}
          style={mood === m.value ? { borderColor: m.color, background: `${m.color}1f` } : {}}
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
          <span className="text-xs text-[var(--muted)] text-center leading-tight">
            {m.label}
          </span>
        </button>
      ))}
    </div>
  )
}
