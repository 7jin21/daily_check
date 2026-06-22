'use client'

import { ENERGY } from '@/lib/constants'
import { useCheckinStore } from '@/stores/checkin'
import { hapticTap } from '@/lib/haptics'

export default function EnergyStep() {
  const { energy, setEnergy } = useCheckinStore()

  const handleSelect = (value: number) => {
    hapticTap()
    setEnergy(value)
  }

  const barHeights = ['h-4', 'h-6', 'h-9', 'h-12', 'h-16']

  return (
    <div className="space-y-4">
      {/* バービジュアル */}
      <div className="flex items-end justify-center gap-3 h-20 mb-2">
        {ENERGY.map((e, i) => (
          <button
            key={e.value}
            onClick={() => handleSelect(e.value)}
            className={`
              w-10 rounded-t-lg transition-all duration-150 active:opacity-80
              ${barHeights[i]}
              ${energy === e.value ? 'opacity-100 scale-110 animate-pop' : 'opacity-40'}
            `}
            style={{ backgroundColor: e.color }}
            aria-label={e.label}
          />
        ))}
      </div>

      {/* リストボタン */}
      <div className="space-y-2">
        {ENERGY.map((e) => (
          <button
            key={e.value}
            onClick={() => handleSelect(e.value)}
            className={`
              w-full flex items-center gap-4 p-4 rounded-[3px] border transition-all duration-150 active:scale-[0.99]
              ${energy === e.value
                ? ''
                : 'border-[var(--border)] bg-[var(--surface)]'
              }
            `}
            style={energy === e.value ? { borderColor: e.color, background: `${e.color}1f` } : {}}
            aria-pressed={energy === e.value}
          >
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: e.color }}
            />
            <div className="text-left">
              <div className="font-semibold text-[var(--foreground)] text-sm">
                {e.value}. {e.label}
              </div>
              <div className="text-xs text-[var(--muted-2)]">{e.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
