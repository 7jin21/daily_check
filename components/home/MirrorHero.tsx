import type { CSSProperties, ReactNode } from 'react'
import { moonAge, moonLitPath, moonName, toKanjiNumber, WEEKDAY_KANJI } from '@/lib/almanac'
import { dayOfWeek, type DayPeriod } from '@/lib/home-model'
import RippleFilter from './RippleFilter'
import WaterTouch from './WaterTouch'

// ホームのヒーロー「水鏡」。空（縦書きの日付・その日の月・星）を、水面が揺らぎながら映す。
// 空と水の色は時間帯（data-period）で変わる。CTA は children として水面の上に置く。

interface Props {
  today: string // YYYY-MM-DD (JST)
  period: DayPeriod
  now: Date
  /** 記録済みの日は空を低くする（読み返しやシートの数字をすぐ見られるように） */
  compact?: boolean
  children: ReactNode
}

// 星の位置（舞台の % 座標）。日付から決まる疑似乱数で、毎日少しずつ違う空になる
function starsFor(seedStr: string) {
  let seed = Array.from(seedStr).reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
  return Array.from({ length: 26 }, () => ({
    x: 4 + rand() * 92,
    y: 3 + rand() * 62,
    r: rand() < 0.18 ? 1.25 : 0.7,
  }))
}

// 月の道（水面のきらめき）。水平線の近くは細く密に、手前ほど広く散らばる
const GLINTS = [
  { top: 2, x: 0, w: 10, o: 0.7, d: 0, t: 3.4 },
  { top: 6, x: -3, w: 16, o: 0.55, d: -1.2, t: 4.1 },
  { top: 10, x: 4, w: 12, o: 0.6, d: -2.6, t: 3.2 },
  { top: 15, x: -6, w: 22, o: 0.45, d: -0.6, t: 4.8 },
  { top: 21, x: 7, w: 14, o: 0.5, d: -3.1, t: 3.7 },
  { top: 27, x: -2, w: 30, o: 0.35, d: -1.8, t: 5.2 },
  { top: 34, x: 10, w: 18, o: 0.4, d: -0.3, t: 4.4 },
  { top: 42, x: -11, w: 26, o: 0.3, d: -2.2, t: 3.9 },
  { top: 51, x: 5, w: 40, o: 0.28, d: -1.0, t: 5.6 },
  { top: 61, x: -8, w: 22, o: 0.26, d: -3.4, t: 4.6 },
  { top: 72, x: 13, w: 34, o: 0.2, d: -1.5, t: 5.1 },
  { top: 85, x: -4, w: 48, o: 0.16, d: -2.8, t: 6.2 },
]

function Moon({ age, idSuffix }: { age: number; idSuffix: string }) {
  const lit = moonLitPath(age, 0, 0, 30)
  const glowId = `im-moon-glow-${idSuffix}`
  const litId = `im-moon-lit-${idSuffix}`
  const clipId = `im-moon-clip-${idSuffix}`
  return (
    <svg className="im-moon" viewBox="-46 -46 92 92" aria-hidden="true">
      <defs>
        <radialGradient id={glowId}>
          <stop offset="0%" stopColor="var(--moon)" stopOpacity="0.3" />
          <stop offset="38%" stopColor="var(--moon)" stopOpacity="0.09" />
          <stop offset="100%" stopColor="var(--moon)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={litId} cx="38%" cy="34%" r="75%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="55%" stopColor="var(--moon)" />
          <stop offset="100%" stopColor="var(--moon)" stopOpacity="0.86" />
        </radialGradient>
        <clipPath id={clipId}>
          <path d={lit} />
        </clipPath>
      </defs>
      <circle r="84" fill={`url(#${glowId})`} />
      {/* 地球照（影の部分もうっすら見える） */}
      <circle r="30" fill="var(--moon)" opacity="0.07" />
      <path d={lit} fill={`url(#${litId})`} />
      {/* 海（ごく淡い模様） */}
      <g clipPath={`url(#${clipId})`} fill="#8a8170" opacity="0.1">
        <circle cx="-8" cy="-9" r="9" />
        <circle cx="9" cy="-4" r="6" />
        <circle cx="2" cy="11" r="7.5" />
        <circle cx="-14" cy="8" r="4" />
      </g>
    </svg>
  )
}

function StageArt({
  monthDay,
  weekday,
  age,
  stars,
  idSuffix,
}: {
  monthDay: string
  weekday: string
  age: number
  stars: { x: number; y: number; r: number }[]
  idSuffix: string
}) {
  return (
    <>
      <svg className="im-stars" width="100%" height="100%" aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
        {stars.map((s, i) => (
          <circle key={i} cx={`${s.x}%`} cy={`${s.y}%`} r={s.r} />
        ))}
      </svg>
      <Moon age={age} idSuffix={idSuffix} />
      <div className="im-date">
        {/* 6文字以上（例: 十二月二十四日）は空に収まらないので、月と日を2列に組む */}
        <p className="im-date-main" data-long={monthDay.length > 5}>
          {Array.from(monthDay).map((ch, i) => (
            <span key={i}>
              {monthDay.length > 5 && i === monthDay.indexOf('月') + 1 && <br />}
              <span className="im-ch" style={{ animationDelay: `${0.18 + i * 0.07}s` }}>
                {ch}
              </span>
            </span>
          ))}
        </p>
        <p className="im-date-sub">{weekday}</p>
      </div>
    </>
  )
}

export default function MirrorHero({ today, period, now, compact = false, children }: Props) {
  const [, m, d] = today.split('-').map(Number)
  const monthDay = `${toKanjiNumber(m)}月${toKanjiNumber(d)}日`
  const weekday = `${WEEKDAY_KANJI[dayOfWeek(today)]}曜日`
  const age = moonAge(now)
  const stars = starsFor(today)

  return (
    <section className="im-mirror im-anim" data-period={period} data-compact={compact} aria-label="今日">
      <RippleFilter />
      <div className="im-sky">
        <div className="im-stage">
          <StageArt monthDay={monthDay} weekday={weekday} age={age} stars={stars} idSuffix="sky" />
        </div>
      </div>

      <div className="im-topbar">
        <span className="im-wordmark">Inner Mirror</span>
        <span className="im-almanac">
          {moonName(age)}
          <br />
          月齢 <b>{age.toFixed(1)}</b>
        </span>
      </div>

      <div className="im-horizon" />

      <div className="im-water">
        <WaterTouch />
        <div className="im-reflection" aria-hidden="true">
          <StageArt monthDay={monthDay} weekday={weekday} age={age} stars={stars} idSuffix="water" />
        </div>
        {period !== 'day' && (
          <div className="im-glints" aria-hidden="true">
            {GLINTS.map((g, i) => (
              <span
                key={i}
                className="im-glint"
                style={
                  {
                    top: `${g.top}%`,
                    left: g.x,
                    width: g.w,
                    animationDelay: `${g.d}s`,
                    '--o': g.o,
                    '--dur': `${g.t}s`,
                  } as CSSProperties
                }
              />
            ))}
          </div>
        )}
      </div>

      <div className="im-cta">{children}</div>
    </section>
  )
}
