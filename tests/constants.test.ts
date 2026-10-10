import { afterEach, describe, expect, it, vi } from 'vitest'
import { energyLabel, getDailyDescription, moodEmoji, moodLabel } from '@/lib/constants'
import { subtractDays } from '@/lib/jst'
import { TIME_ZONES, withTZ } from './helpers'

const STEP_IDS = ['state', 'notes', 'mood', 'energy', 'events', 'challenges', 'gratitude', 'freeform']

/** start から n 日分の日付 */
function datesFrom(start: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => subtractDays(start, -i))
}

describe('getDailyDescription', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('同じ日付なら、プロセスのタイムゾーンが違っても同じ文になる', () => {
    // TZ の切り替えが効いていること自体も確かめる（効いていなければこのテストは意味がない）
    const offsets = TIME_ZONES.map((tz) => withTZ(tz, () => new Date(2026, 0, 1).getTimezoneOffset()))
    expect(new Set(offsets).size).toBe(TIME_ZONES.length)

    for (const date of ['2026-10-10', '2026-01-01', '2026-03-08', '2026-11-01', '2024-02-29']) {
      for (const id of STEP_IDS) {
        const texts = TIME_ZONES.map((tz) => withTZ(tz, () => getDailyDescription(id, date)))
        expect(new Set(texts).size, `${id} ${date}`).toBe(1)
      }
    }
  })

  it('日付を省くと日本時間の今日を使う（端末が UTC やアメリカでも）', () => {
    vi.useFakeTimers({ now: new Date('2026-10-09T15:30:00Z') }) // JST 2026-10-10 00:30
    for (const tz of TIME_ZONES) {
      withTZ(tz, () => {
        expect(getDailyDescription('notes')).toBe(getDailyDescription('notes', '2026-10-10'))
      })
    }
  })

  it('連続する7日間で7つの文が1回ずつ出る', () => {
    for (const start of ['2026-10-04', '2026-09-28', '2024-02-26']) {
      for (const id of STEP_IDS) {
        const texts = datesFrom(start, 7).map((d) => getDailyDescription(id, d))
        expect(new Set(texts).size, `${id} from ${start}`).toBe(7)
      }
    }
  })

  it('8日目には1日目と同じ文に戻る', () => {
    expect(getDailyDescription('notes', '2026-10-11')).toBe(getDailyDescription('notes', '2026-10-04'))
  })

  // 以前は日数を「2024年の同じ月日」で数えていたため、平年の2月末→3月1日で1日飛び、
  // 年末→元日で数日前の文に戻っていた（7日間に同じ文が2回出る）
  it('年末年始・平年の2月末をまたいでも7日間で7つの文が出る', () => {
    for (const start of ['2026-12-29', '2026-02-25']) {
      const texts = datesFrom(start, 7).map((d) => getDailyDescription('notes', d))
      expect(new Set(texts).size, `from ${start}`).toBe(7)
    }
  })

  it('知らないステップなら空文字', () => {
    expect(getDailyDescription('unknown', '2026-10-10')).toBe('')
  })
})

describe('moodEmoji / moodLabel / energyLabel', () => {
  it('1〜5 の値に対応する絵文字・ラベルを返す', () => {
    expect([1, 2, 3, 4, 5].map((v) => moodEmoji(v))).toEqual(['😞', '😕', '😐', '🙂', '😄'])
    expect([1, 2, 3, 4, 5].map((v) => moodLabel(v))).toEqual(['とても悪い', '悪い', '普通', '良い', 'とても良い'])
    expect([1, 2, 3, 4, 5].map((v) => energyLabel(v))).toEqual(['枯渇', '低い', '普通', '高い', '最高'])
  })

  it('範囲外・未入力なら undefined（既定は呼び出し側で決める）', () => {
    for (const v of [0, 6, 3.5, null, undefined]) {
      expect(moodEmoji(v)).toBeUndefined()
      expect(moodLabel(v)).toBeUndefined()
      expect(energyLabel(v)).toBeUndefined()
    }
  })
})
