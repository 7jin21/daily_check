'use client'

import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { MOODS, ENERGY } from '@/lib/constants'
import { useCheckinStore } from '@/stores/checkin'
import { hapticTap } from '@/lib/haptics'
import { EnergyGlyph, MoodGlyph } from '@/components/ui/StateGlyphs'
import CheckinStage from './CheckinStage'
import Wbr from '@/components/ui/Wbr'

// チェックイン1画面目: 気分（月の満ち欠け）とエネルギー（水位）を選ぶ。
// 上の小さな水鏡が、選んだ調子をその場で映す。選ぶ部品は親指の届く下側に置く。

interface Option {
  value: number
  label: string
  glyph: ReactNode
}

/** 5段階のラジオボタン。左右の矢印キーでも選べる（選んだものだけがタブで止まる） */
function ScalePicker({
  name,
  hint,
  options,
  value,
  onChange,
}: {
  name: string
  hint: string
  options: Option[]
  value: number | null
  onChange: (v: number) => void
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const labelId = `ck-picker-${name}`

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }
    const delta = keys[e.key]
    if (!delta) return
    e.preventDefault()
    const current = value === null ? (delta > 0 ? -1 : options.length) : options.findIndex((o) => o.value === value)
    const next = Math.min(options.length - 1, Math.max(0, current + delta))
    onChange(options[next].value)
    refs.current[next]?.focus()
  }

  return (
    <div className="ck-picker">
      <p className="ck-picker-label" id={labelId}>
        {name}
        <span>{hint}</span>
      </p>
      <div className="ck-options" role="radiogroup" aria-labelledby={labelId} onKeyDown={onKeyDown}>
        {options.map((o, i) => {
          const checked = value === o.value
          // 何も選んでいないときは最初の選択肢でタブが止まる
          const focusable = checked || (value === null && i === 0)
          return (
            <button
              key={o.value}
              ref={(el) => {
                refs.current[i] = el
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={focusable ? 0 : -1}
              className="ck-option"
              onClick={() => onChange(o.value)}
            >
              {o.glyph}
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function StateStep() {
  const { mood, energy, setMood, setEnergy } = useCheckinStore()

  const pickMood = (v: number) => {
    hapticTap()
    setMood(v)
  }
  const pickEnergy = (v: number) => {
    hapticTap()
    setEnergy(v)
  }

  const moodText = MOODS.find((m) => m.value === mood)?.label
  const energyText = ENERGY.find((e) => e.value === energy)?.description

  return (
    <div className="ck-state">
      <CheckinStage mood={mood} energy={energy} />

      {/* 選んだ調子を、ことばでも返す（読み上げにも伝わるように aria-live） */}
      <p className="ck-caption" data-empty={!moodText && !energyText} aria-live="polite">
        {moodText || energyText ? (
          <>
            {moodText ?? '気分は？'}
            <i aria-hidden="true">・</i>
            {energyText ?? 'エネルギーは？'}
          </>
        ) : (
          <Wbr text="気分は月の満ち欠けで、|エネルギーは水の高さで|映します" />
        )}
      </p>

      <ScalePicker
        name="気分"
        hint="沈む ― 晴れる"
        value={mood}
        onChange={pickMood}
        options={MOODS.map((m) => ({ value: m.value, label: m.label, glyph: <MoodGlyph mood={m.value} size={34} /> }))}
      />
      <ScalePicker
        name="エネルギー"
        hint="枯渇 ― 満ちている"
        value={energy}
        onChange={pickEnergy}
        options={ENERGY.map((e) => ({ value: e.value, label: e.label, glyph: <EnergyGlyph energy={e.value} size={34} /> }))}
      />
    </div>
  )
}
