'use client'

import { MOODS, ENERGY } from '@/lib/constants'
import { useCheckinStore } from '@/stores/checkin'
import { hapticTap } from '@/lib/haptics'

// チェックイン1画面目: 気分＋エネルギーを1画面で選ぶ（旧 MoodStep / EnergyStep を統合）
export default function StateStep() {
  const { mood, energy, setMood, setEnergy } = useCheckinStore()

  const handleMood = (value: number) => {
    hapticTap()
    setMood(value)
  }

  const handleEnergy = (value: number) => {
    hapticTap()
    setEnergy(value)
  }

  // エネルギーバーの高さ（1〜5で段階的に）
  const barHeights = [14, 20, 28, 36, 46]

  return (
    <div className="space-y-8">
      {/* 気分 */}
      <section>
        <p className="text-sm font-medium text-[var(--muted)] mb-3">気分</p>
        <div className="grid grid-cols-5 gap-2.5">
          {MOODS.map((m) => (
            <button
              key={m.value}
              onClick={() => handleMood(m.value)}
              className={`
                flex flex-col items-center gap-2 p-3 rounded-[3px] border transition-all duration-150 active:scale-95
                ${mood === m.value ? 'scale-105' : 'border-[var(--border)] bg-[var(--surface)]'}
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
      </section>

      {/* エネルギー */}
      <section>
        <p className="text-sm font-medium text-[var(--muted)] mb-3">エネルギー</p>
        <div className="grid grid-cols-5 gap-2.5">
          {ENERGY.map((e, i) => (
            <button
              key={e.value}
              onClick={() => handleEnergy(e.value)}
              className={`
                flex flex-col items-center justify-end gap-2 p-3 pt-2 rounded-[3px] border transition-all duration-150 active:scale-95
                ${energy === e.value ? 'scale-105' : 'border-[var(--border)] bg-[var(--surface)]'}
              `}
              style={energy === e.value ? { borderColor: e.color, background: `${e.color}1f` } : {}}
              aria-label={`${e.label} — ${e.description}`}
              aria-pressed={energy === e.value}
            >
              <span className="flex items-end" style={{ height: 46 }}>
                <span
                  key={energy === e.value ? 'selected' : 'idle'}
                  className={`block w-5 rounded-t-sm ${energy === e.value ? 'animate-pop' : 'opacity-50'}`}
                  style={{ height: barHeights[i], backgroundColor: e.color }}
                />
              </span>
              <span className="text-xs text-[var(--muted)] text-center leading-tight">
                {e.label}
              </span>
            </button>
          ))}
        </div>
        {/* 選択中エネルギーの補足説明 */}
        <p className="text-xs text-[var(--muted-2)] mt-2 min-h-4 text-center">
          {energy !== null ? ENERGY.find((e) => e.value === energy)?.description : '　'}
        </p>
      </section>
    </div>
  )
}
