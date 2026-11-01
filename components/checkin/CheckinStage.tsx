'use client'

import { useEffect, useId, useRef, type CSSProperties } from 'react'
import { moodLight, moonPhasePath } from '@/lib/state-glyph'

// チェックイン1画面目の小さな「水鏡」。
// 気分 → 空がその気分の色に染まり、月が満ちる（光の量 = 気分）
// エネルギー → 水位が上がる（「枯渇」は干上がりかけ、「最高」は月に届きそうなほど）。水が深いほど、月がはっきり映る
// 飾りなので読み上げからは外す（選んだ内容は下のことばと選択肢で伝える）。

/** 舞台の高さに対する水位（エネルギー 1〜5） */
const STAGE_LEVEL = [0.14, 0.22, 0.3, 0.38, 0.46]
const R = 40
const DURATION = 750

export default function CheckinStage({ mood, energy }: { mood: number | null; energy: number | null }) {
  const uid = useId().replace(/:/g, '')
  const blurId = `ck-blur-${uid}`
  const shadeId = `ck-shade-${uid}`
  const clipId = `ck-clip-${uid}`
  const litRef = useRef(0)
  const moonRef = useRef<SVGPathElement>(null)
  const reflectionRef = useRef<SVGPathElement>(null)
  const clipRef = useRef<SVGPathElement>(null)
  const glowRef = useRef<SVGPathElement>(null)
  const target = moodLight(mood) ?? 0

  // 月の満ち欠けを、いまの形から次の形へなめらかに変える（パスの形は CSS では補間できないので、毎フレーム描き直す）
  useEffect(() => {
    const draw = (v: number) => {
      const d = moonPhasePath(v, R)
      moonRef.current?.setAttribute('d', d)
      reflectionRef.current?.setAttribute('d', d)
      clipRef.current?.setAttribute('d', d)
      glowRef.current?.setAttribute('d', d)
    }
    const from = litRef.current
    if (from === target || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      litRef.current = target
      draw(target)
      return
    }
    let raf = 0
    const start = performance.now()
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / DURATION)
      const eased = 1 - Math.pow(1 - k, 3)
      const v = from + (target - from) * eased
      litRef.current = v
      draw(v)
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target])

  // まだ選んでいないときは浅い水たまり（CSS で薄く見せる）
  const level = energy ? STAGE_LEVEL[energy - 1] : 0.07
  const style = {
    ...(mood ? { '--ck-tint': `var(--mood-${mood})` } : {}),
    '--ck-level': level,
    '--ck-lit': target,
  } as CSSProperties

  // 光は「光っている形」にだけ沿わせる（円盤ぜんたいを光で囲むと、細い月のとき影の側が明るい穴に見えるため）。
  // 水面の映り込みには光を描かない（映り込みの箱で光が四角く切れて見えるため）
  const moon = (ref: typeof moonRef, glow: boolean) => (
    <>
      {glow && (
        <path ref={glowRef} className="ck-moon-glow" d={moonPhasePath(litRef.current, R)} filter={`url(#${blurId})`} />
      )}
      <circle className="ck-moon-disc" r={R} />
      <path ref={ref} className="ck-moon-lit" d={moonPhasePath(litRef.current, R)} style={{ fill: `url(#${shadeId})` }} />
      <g className="ck-moon-seas" clipPath={`url(#${clipId})`}>
        <circle cx={-11} cy={-12} r={12} />
        <circle cx={12} cy={-5} r={8} />
        <circle cx={3} cy={15} r={10} />
        <circle cx={-19} cy={10} r={5} />
      </g>
    </>
  )

  return (
    <div className="ck-stage" data-mood={mood ?? undefined} data-energy={energy ?? undefined} style={style} aria-hidden="true">
      <svg className="ck-moon" viewBox="-50 -50 100 100">
        <defs>
          {/* 月の光（光っている形をぼかして、うしろに敷く） */}
          <filter id={blurId} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="9" />
          </filter>
          {/* 月の明るいところの陰影（満ちていく右側から光が当たったように） */}
          <radialGradient id={shadeId} cx="66%" cy="34%" r="80%">
            <stop offset="0%" style={{ stopColor: 'color-mix(in srgb, var(--ck-tint) 55%, #fff)' }} />
            <stop offset="55%" style={{ stopColor: 'var(--ck-tint)' }} />
            <stop offset="100%" style={{ stopColor: 'color-mix(in srgb, var(--ck-tint) 82%, #000)' }} />
          </radialGradient>
          {/* 月の海は、光っている部分の形で切り抜く */}
          <clipPath id={clipId}>
            <path ref={clipRef} d={moonPhasePath(litRef.current, R)} />
          </clipPath>
        </defs>
        {moon(moonRef, true)}
      </svg>
      <div className="ck-water">
        <svg className="ck-wave" viewBox="0 0 400 8" preserveAspectRatio="none">
          <path d="M0 8 V4 Q25 0 50 4 T100 4 T150 4 T200 4 T250 4 T300 4 T350 4 T400 4 V8 Z" />
        </svg>
        <svg className="ck-reflection" viewBox="-50 -50 100 100">
          {moon(reflectionRef, false)}
        </svg>
      </div>
    </div>
  )
}
