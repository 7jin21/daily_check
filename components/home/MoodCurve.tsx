'use client'

import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import Link from 'next/link'
import { ENERGY, MOODS } from '@/lib/constants'
import { dayOfWeek, type HomeEntry } from '@/lib/home-model'
import { WEEKDAY_KANJI } from '@/lib/almanac'

// 気分の波（直近14回）。上段 = 気分の波線（その高さの気分の色で塗る）／下段 = エネルギーの細い棒。
// 点をタップ（または横になぞる）すると、その日の気分・エネルギーが上に出て、日記を開ける。

const CW = 346
const CH = 196
const PAD = { l: 16, r: 8 }
const MOOD_TOP = 12
const MOOD_BOTTOM = 118
const ENERGY_TOP = 138
const ENERGY_BOTTOM = 166

const moodColor = (mood: number) => MOODS.find((m) => m.value === mood)?.color ?? '#cdbf9a'
const shortDate = (d: string) => `${Number(d.slice(5, 7))}.${Number(d.slice(8, 10))}`

/** Catmull-Rom を 3 次ベジェに変換した滑らかな線。制御点は描画範囲内に収めて行き過ぎを防ぐ */
function smoothPath(pts: { x: number; y: number }[], minY: number, maxY: number): string {
  if (pts.length < 2) return ''
  const clamp = (v: number) => Math.min(maxY, Math.max(minY, v))
  const f = (n: number) => n.toFixed(1)
  let d = `M ${f(pts[0].x)} ${f(pts[0].y)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = clamp(p1.y + (p2.y - p0.y) / 6)
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = clamp(p2.y - (p3.y - p1.y) / 6)
    d += ` C ${f(c1x)} ${f(c1y)}, ${f(c2x)} ${f(c2y)}, ${f(p2.x)} ${f(p2.y)}`
  }
  return d
}

export default function MoodCurve({ entries }: { entries: HomeEntry[] }) {
  const data = entries.slice(0, 14).reverse()
  const [sel, setSel] = useState(data.length - 1)
  const svgRef = useRef<SVGSVGElement>(null)
  const dragging = useRef(false)

  const plotW = CW - PAD.l - PAD.r
  const x = (i: number) => PAD.l + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW)
  const y = (v: number) => MOOD_TOP + ((5 - v) / 4) * (MOOD_BOTTOM - MOOD_TOP)
  const pts = data.map((e, i) => ({ x: x(i), y: y(e.mood) }))
  const line = smoothPath(pts, MOOD_TOP, MOOD_BOTTOM)
  const area = line
    ? `${line} L ${pts[pts.length - 1].x.toFixed(1)} ${MOOD_BOTTOM} L ${pts[0].x.toFixed(1)} ${MOOD_BOTTOM} Z`
    : ''
  const barW = Math.min(5, (plotW / Math.max(1, data.length)) * 0.22)

  /** 画面上の x 座標から、いちばん近い点を選ぶ */
  const pick = (clientX: number) => {
    const svg = svgRef.current
    if (!svg || data.length === 0) return
    const rect = svg.getBoundingClientRect()
    const vx = ((clientX - rect.left) / rect.width) * CW
    let best = 0
    pts.forEach((p, i) => {
      if (Math.abs(p.x - vx) < Math.abs(pts[best].x - vx)) best = i
    })
    setSel(best)
  }

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    dragging.current = true
    pick(e.clientX)
  }
  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (dragging.current) pick(e.clientX)
  }
  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === 'ArrowLeft') setSel((s) => Math.max(0, s - 1))
    if (e.key === 'ArrowRight') setSel((s) => Math.min(data.length - 1, s + 1))
  }

  const cur = data[sel] ?? data[data.length - 1]
  if (!cur) return null
  const curMood = MOODS.find((m) => m.value === cur.mood)
  const curEnergy = ENERGY.find((e) => e.value === cur.energy)

  return (
    <>
      {/* 選んだ日の読み取り */}
      <div className="im-curve-readout" aria-live="polite">
        <span className="im-curve-readout-date">
          {shortDate(cur.entry_date)}
          <small>{WEEKDAY_KANJI[dayOfWeek(cur.entry_date)]}</small>
        </span>
        <span className="im-curve-readout-vals">
          <span>
            <i style={{ background: moodColor(cur.mood) }} />
            気分 {curMood?.label ?? '—'}
          </span>
          <span>エネルギー {curEnergy?.label ?? '—'}</span>
        </span>
        <Link href={`/entries/${cur.entry_date}`} className="im-curve-open">
          開く ›
        </Link>
      </div>

      <svg
        ref={svgRef}
        className="im-curve"
        viewBox={`0 0 ${CW} ${CH}`}
        role="slider"
        tabIndex={0}
        aria-label="気分の波。左右で日を選べます"
        aria-valuemin={1}
        aria-valuemax={data.length}
        aria-valuenow={sel + 1}
        aria-valuetext={`${shortDate(cur.entry_date)} 気分 ${curMood?.label ?? ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => (dragging.current = false)}
        onPointerLeave={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
        onKeyDown={onKeyDown}
      >
        <defs>
          {/* 塗りの色＝その高さの気分の色（上ほど晴れ、下ほど沈む） */}
          <linearGradient id="im-curve-fill" gradientUnits="userSpaceOnUse" x1="0" y1={MOOD_TOP} x2="0" y2={MOOD_BOTTOM}>
            <stop offset="0%" stopColor={moodColor(5)} stopOpacity="0.42" />
            <stop offset="50%" stopColor={moodColor(3)} stopOpacity="0.22" />
            <stop offset="100%" stopColor={moodColor(1)} stopOpacity="0.06" />
          </linearGradient>
        </defs>
        {[5, 3, 1].map((v) => (
          <g key={v}>
            <line className="im-curve-guide" x1={PAD.l} x2={CW - PAD.r} y1={y(v)} y2={y(v)} />
            <text className="im-curve-guide-label" x={0} y={y(v) + 3}>
              {v}
            </text>
          </g>
        ))}
        {/* 選んだ日の縦線 */}
        <line className="im-curve-cursor" x1={pts[sel].x} x2={pts[sel].x} y1={MOOD_TOP - 6} y2={ENERGY_BOTTOM} />
        <path d={area} fill="url(#im-curve-fill)" />
        <path className="im-curve-mood" d={line} />
        {data.map((e, i) => (
          <circle
            key={e.entry_date}
            className="im-curve-dot"
            cx={pts[i].x}
            cy={pts[i].y}
            r={i === sel ? 5.5 : 3.2}
            fill={moodColor(e.mood)}
          />
        ))}
        {/* エネルギー */}
        <line className="im-curve-guide" x1={PAD.l} x2={CW - PAD.r} y1={ENERGY_BOTTOM} y2={ENERGY_BOTTOM} />
        {data.map((e, i) => {
          const h = (Math.max(1, Math.min(5, e.energy)) / 5) * (ENERGY_BOTTOM - ENERGY_TOP)
          return (
            <rect
              key={`e${e.entry_date}`}
              className="im-curve-energy"
              data-sel={i === sel}
              x={pts[i].x - barW / 2}
              y={ENERGY_BOTTOM - h}
              width={barW}
              height={h}
              rx={barW / 2}
            />
          )
        })}
        <text className="im-curve-x" x={pts[0].x} y={CH - 4} textAnchor="start">
          {shortDate(data[0].entry_date)}
        </text>
        <text className="im-curve-x" x={pts[pts.length - 1].x} y={CH - 4} textAnchor="end">
          {shortDate(data[data.length - 1].entry_date)}
        </text>
      </svg>
      <div className="im-curve-legend im-label">
        <span>
          <i />
          気分
        </span>
        <span>
          <i data-kind="energy" />
          エネルギー
        </span>
        <span className="im-curve-hint">点をタップ・なぞると、その日を表示</span>
      </div>
    </>
  )
}
