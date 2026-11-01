import { describe, expect, it } from 'vitest'
import { energyLevel, moodLight, moonPhasePath, waterPath } from '@/lib/state-glyph'

describe('気分 → 月の明るさ（moodLight）', () => {
  it('気分がいいほど明るく、3 はちょうど半月、5 は満月', () => {
    const lights = [1, 2, 3, 4, 5].map((m) => moodLight(m) as number)
    for (let i = 1; i < lights.length; i++) expect(lights[i]).toBeGreaterThan(lights[i - 1])
    expect(moodLight(3)).toBe(0.5)
    expect(moodLight(5)).toBe(1)
  })

  it('気分が「とても悪い」でも、細い光は残す（真っ暗にしない）', () => {
    expect(moodLight(1)).toBeGreaterThan(0)
  })

  it('範囲外・未入力は null', () => {
    for (const v of [0, 6, 2.5, null, undefined]) expect(moodLight(v)).toBeNull()
  })
})

describe('エネルギー → 水位（energyLevel）', () => {
  it('元気なほど水位が高く、3 はちょうど半分、5 でもあふれない', () => {
    const levels = [1, 2, 3, 4, 5].map((e) => energyLevel(e) as number)
    for (let i = 1; i < levels.length; i++) expect(levels[i]).toBeGreaterThan(levels[i - 1])
    expect(energyLevel(3)).toBe(0.5)
    expect(energyLevel(5)).toBeLessThan(1)
    expect(energyLevel(1)).toBeGreaterThan(0)
  })

  it('範囲外・未入力は null', () => {
    for (const v of [0, 6, 1.5, null, undefined]) expect(energyLevel(v)).toBeNull()
  })
})

/** パスの数字を取り出す */
const nums = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)

describe('月の形（moonPhasePath）', () => {
  it('半月は境目がまっすぐ（楕円の横半径が 0）', () => {
    // M 0 -r A r r 0 0 1 0 r A rx r 0 0 sweep 0 -r Z → rx は 2つ目の弧の最初の数字
    const n = nums(moonPhasePath(0.5, 10))
    expect(n[9]).toBe(0)
  })

  it('三日月は境目が光る側へ、満ちた月は反対側へふくらむ', () => {
    expect(moonPhasePath(0.2, 10)).toMatch(/0 0 0 0 -10\.00 Z$/)
    expect(moonPhasePath(0.8, 10)).toMatch(/0 0 1 0 -10\.00 Z$/)
  })

  it('満月は円になる（境目の横半径が半径と同じ）', () => {
    const n = nums(moonPhasePath(1, 12))
    expect(n[9]).toBe(12)
  })

  it('0〜1 の外は端に丸める', () => {
    expect(moonPhasePath(2, 10)).toBe(moonPhasePath(1, 10))
    expect(moonPhasePath(-1, 10)).toBe(moonPhasePath(0, 10))
  })
})

describe('器の水（waterPath）', () => {
  it('水位が半分を超えると、大きい方の弧で回る', () => {
    expect(waterPath(0.3, 10)).toMatch(/A 10\.00 10\.00 0 0 1/)
    expect(waterPath(0.8, 10)).toMatch(/A 10\.00 10\.00 0 1 1/)
  })

  it('水面の両端は円の上にある', () => {
    const r = 10
    const n = nums(waterPath(0.3, r, 0))
    const [x, y] = [n[0], n[1]]
    expect(Math.hypot(x, y)).toBeCloseTo(r, 1)
  })
})
