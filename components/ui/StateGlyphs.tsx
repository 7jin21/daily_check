import type { CSSProperties } from 'react'
import { energyLevel, moodLight, moonPhasePath, waterPath } from '@/lib/state-glyph'

// 気分 = 月の満ち欠け、エネルギー = 器の水位 の小さな図形。
// チェックインの選択肢・日記の詳細・一覧・インサイト・共有画像で同じ形を使う（どこで見ても同じ読み方になるように）。
// 色はトークン（--mood-1〜5 / --water）から。hooks を使わないので、サーバーでもクライアントでも描ける。

const R = 12

interface GlyphProps {
  size?: number
  className?: string
  style?: CSSProperties
  /** 読み上げ用の名前。渡さなければ飾り（aria-hidden）として扱う */
  label?: string
}

function a11y(label?: string) {
  return label ? { role: 'img' as const, 'aria-label': label } : { 'aria-hidden': true as const }
}

/** 気分の月。光っている部分が多いほど気分がいい（範囲外の値なら輪郭だけ） */
export function MoodGlyph({ mood, size = 28, className, style, label }: GlyphProps & { mood: number | null | undefined }) {
  const lit = moodLight(mood)
  const color = lit === null ? 'var(--faint)' : `var(--mood-${mood})`
  return (
    <svg width={size} height={size} viewBox="-15 -15 30 30" className={className} style={style} {...a11y(label)}>
      <circle
        r={R}
        strokeWidth={1}
        style={{
          fill: `color-mix(in srgb, ${color} 16%, transparent)`,
          stroke: `color-mix(in srgb, ${color} 60%, transparent)`,
        }}
      />
      {lit !== null && <path d={moonPhasePath(lit, R)} style={{ fill: color }} />}
    </svg>
  )
}

/** エネルギーの器。水位が高いほど元気（範囲外の値なら空の器） */
export function EnergyGlyph({ energy, size = 28, className, style, label }: GlyphProps & { energy: number | null | undefined }) {
  const level = energyLevel(energy)
  return (
    <svg width={size} height={size} viewBox="-15 -15 30 30" className={className} style={style} {...a11y(label)}>
      <circle
        r={R}
        strokeWidth={1}
        style={{
          fill: 'color-mix(in srgb, var(--water) 10%, transparent)',
          stroke: 'color-mix(in srgb, var(--water) 60%, transparent)',
        }}
      />
      {level !== null && <path d={waterPath(level, R - 0.5)} style={{ fill: 'var(--water)' }} />}
    </svg>
  )
}
