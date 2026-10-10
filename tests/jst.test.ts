import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  APP_TIME_ZONE,
  dayOfWeek,
  daysBetween,
  formatJSTDate,
  jstHour,
  jstNoon,
  jstTimeHM,
  subtractDays,
  toJSTDate,
  todayJST,
} from '@/lib/jst'
import { TIME_ZONES, withTZ } from './helpers'

describe('APP_TIME_ZONE', () => {
  it('日本時間で1日を区切る', () => {
    expect(APP_TIME_ZONE).toBe('Asia/Tokyo')
  })
})

describe('subtractDays', () => {
  it('n 日前を返す（0 ならそのまま）', () => {
    expect(subtractDays('2026-10-10', 1)).toBe('2026-10-09')
    expect(subtractDays('2026-10-10', 7)).toBe('2026-10-03')
    expect(subtractDays('2026-10-10', 0)).toBe('2026-10-10')
  })

  it('月の境目をまたぐ', () => {
    expect(subtractDays('2026-10-01', 1)).toBe('2026-09-30')
    expect(subtractDays('2026-05-01', 1)).toBe('2026-04-30')
    expect(subtractDays('2026-10-10', 30)).toBe('2026-09-10')
  })

  it('年の境目をまたぐ', () => {
    expect(subtractDays('2026-01-01', 1)).toBe('2025-12-31')
    expect(subtractDays('2026-10-10', 365)).toBe('2025-10-10')
  })

  it('うるう年の2月29日を数える', () => {
    expect(subtractDays('2024-03-01', 1)).toBe('2024-02-29')
    expect(subtractDays('2026-03-01', 1)).toBe('2026-02-28')
    expect(subtractDays('2000-03-01', 1)).toBe('2000-02-29') // 400 で割り切れる年はうるう年
    expect(subtractDays('2100-03-01', 1)).toBe('2100-02-28') // 100 で割り切れる年は平年
    // 2024 年は 366 日ある
    expect(subtractDays('2024-12-31', 366)).toBe('2023-12-31')
  })

  it('負の n なら n 日後を返す', () => {
    expect(subtractDays('2025-12-31', -1)).toBe('2026-01-01')
    expect(subtractDays('2024-02-28', -1)).toBe('2024-02-29')
    expect(subtractDays('2026-10-10', -30)).toBe('2026-11-09')
  })

  it('プロセスのタイムゾーンに左右されない', () => {
    for (const tz of TIME_ZONES) {
      withTZ(tz, () => {
        expect(subtractDays('2026-03-08', 1)).toBe('2026-03-07') // 米国の夏時間の開始日
        expect(subtractDays('2026-11-02', 1)).toBe('2026-11-01') // 米国の夏時間の終了日の翌日
      })
    }
  })
})

describe('dayOfWeek', () => {
  it('曜日を 0=日 〜 6=土 で返す', () => {
    expect(dayOfWeek('2026-10-10')).toBe(6) // 土
    expect(dayOfWeek('2026-10-11')).toBe(0) // 日
    expect(dayOfWeek('2026-10-12')).toBe(1) // 月
    expect(dayOfWeek('2000-01-01')).toBe(6) // 土
    expect(dayOfWeek('2024-02-29')).toBe(4) // 木
    expect(dayOfWeek('1970-01-01')).toBe(4) // 木
  })

  it('プロセスのタイムゾーンに左右されない', () => {
    for (const tz of TIME_ZONES) {
      withTZ(tz, () => {
        expect(dayOfWeek('2026-10-10')).toBe(6)
        expect(dayOfWeek('2026-01-01')).toBe(4)
      })
    }
  })
})

describe('daysBetween', () => {
  it('to が後なら正、前なら負、同じ日なら 0', () => {
    expect(daysBetween('2026-10-03', '2026-10-10')).toBe(7)
    expect(daysBetween('2026-10-10', '2026-10-03')).toBe(-7)
    expect(daysBetween('2026-10-10', '2026-10-10')).toBe(0)
  })

  it('月・年・うるう日をまたいでも整数の日数になる', () => {
    expect(daysBetween('2026-02-28', '2026-03-01')).toBe(1)
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2)
    expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1)
    expect(daysBetween('2025-10-10', '2026-10-10')).toBe(365)
    expect(daysBetween('2024-01-01', '2025-01-01')).toBe(366)
  })

  it('夏時間のある TZ でも整数のまま', () => {
    withTZ('America/Los_Angeles', () => {
      expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2)
      expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2)
    })
  })

  it('subtractDays と逆の関係になる', () => {
    for (const n of [0, 1, 6, 30, 365, 400]) {
      expect(daysBetween(subtractDays('2026-10-10', n), '2026-10-10')).toBe(n)
    }
  })
})

describe('toJSTDate', () => {
  it('日本時間の0時で日付が変わる', () => {
    expect(toJSTDate(new Date('2026-10-09T14:59:59.999Z'))).toBe('2026-10-09') // JST 23:59:59
    expect(toJSTDate(new Date('2026-10-09T15:00:00Z'))).toBe('2026-10-10') // JST 00:00
  })

  it('年越しも日本時間で判定する', () => {
    expect(toJSTDate(new Date('2025-12-31T14:59:59Z'))).toBe('2025-12-31')
    expect(toJSTDate(new Date('2025-12-31T15:00:00Z'))).toBe('2026-01-01')
  })

  it('プロセスのタイムゾーンに左右されない', () => {
    for (const tz of TIME_ZONES) {
      withTZ(tz, () => {
        expect(toJSTDate(new Date('2026-10-09T15:30:00Z'))).toBe('2026-10-10')
        expect(toJSTDate(new Date('2026-10-10T14:30:00Z'))).toBe('2026-10-10')
      })
    }
  })
})

describe('todayJST', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('いまの日本時間の日付を返す（UTC ではまだ前日の時間帯でも）', () => {
    vi.useFakeTimers({ now: new Date('2026-10-09T15:30:00Z') })
    withTZ('UTC', () => {
      expect(todayJST()).toBe('2026-10-10')
    })
  })
})

describe('jstNoon', () => {
  it('その日の日本時間の正午を指す', () => {
    expect(jstNoon('2026-10-10').toISOString()).toBe('2026-10-10T03:00:00.000Z')
    expect(jstNoon('2026-01-01').toISOString()).toBe('2026-01-01T03:00:00.000Z')
  })
})

describe('formatJSTDate', () => {
  it('日本語の日付で表示する', () => {
    expect(formatJSTDate('2026-10-10', { month: 'long', day: 'numeric' })).toBe('10月10日')
    expect(formatJSTDate('2026-10-09', { month: 'long', day: 'numeric', weekday: 'long' })).toBe('10月9日金曜日')
    expect(formatJSTDate('2026-10-10', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })).toBe(
      '2026年10月10日(土)'
    )
  })

  it('プロセスのタイムゾーンで日付がずれない', () => {
    for (const tz of TIME_ZONES) {
      withTZ(tz, () => {
        expect(formatJSTDate('2026-01-01', { month: 'long', day: 'numeric', weekday: 'long' })).toBe('1月1日木曜日')
      })
    }
  })
})

describe('jstTimeHM / jstHour', () => {
  it('日本時間の時刻を返す', () => {
    expect(jstTimeHM(new Date('2026-10-09T15:05:00Z'))).toBe('00:05')
    expect(jstTimeHM(new Date('2026-10-10T12:34:00Z'))).toBe('21:34')
  })

  it('時は 0〜23 で返す（0時を 24 としない）', () => {
    expect(jstHour(new Date('2026-10-09T15:00:00Z'))).toBe(0)
    expect(jstHour(new Date('2026-10-09T14:59:00Z'))).toBe(23)
    expect(jstHour(new Date('2026-10-10T03:00:00Z'))).toBe(12)
  })

  it('プロセスのタイムゾーンに左右されない', () => {
    for (const tz of TIME_ZONES) {
      withTZ(tz, () => {
        expect(jstHour(new Date('2026-10-09T22:00:00Z'))).toBe(7)
        expect(jstTimeHM(new Date('2026-10-09T22:00:00Z'))).toBe('07:00')
      })
    }
  })
})
