import { describe, expect, it } from 'vitest'
import { buildHomeModel, periodOf, type HomeEntry } from '@/lib/home-model'
import { withTZ } from './helpers'

// 2026-10-10（土）の日本時間 12:00
const NOON = new Date('2026-10-10T03:00:00Z')

function entry(date: string, mood = 3): HomeEntry {
  return { id: date, entry_date: date, mood, energy: 3, summary: null, dominant_emotion: null, tags: [] }
}

/** 新しい順に並べる（本番のクエリと同じ順） */
function entries(...dates: string[]): HomeEntry[] {
  return dates.map((d) => entry(d)).sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1))
}

describe('periodOf', () => {
  it.each([
    [0, 'night'],
    [3, 'night'],
    [4, 'dawn'],
    [6, 'dawn'],
    [7, 'day'],
    [15, 'day'],
    [16, 'dusk'],
    [18, 'dusk'],
    [19, 'night'],
    [23, 'night'],
  ] as const)('%i 時は %s', (hour, period) => {
    expect(periodOf(hour)).toBe(period)
  })
})

describe('buildHomeModel', () => {
  it('今日・昨日・時間帯を日本時間で決める', () => {
    const m = buildHomeModel([], 0, NOON)
    expect(m.today).toBe('2026-10-10')
    expect(m.yesterday).toBe('2026-10-09')
    expect(m.hourJST).toBe(12)
    expect(m.period).toBe('day')
  })

  it('日本時間の0時すぎは、UTC ではまだ前日でも今日として扱う', () => {
    withTZ('UTC', () => {
      const m = buildHomeModel([], 0, new Date('2026-10-09T15:30:00Z'))
      expect(m.today).toBe('2026-10-10')
      expect(m.hourJST).toBe(0)
      expect(m.period).toBe('night')
    })
  })

  describe('連続記録日数', () => {
    it('今日を書いていれば今日から数える', () => {
      const m = buildHomeModel(entries('2026-10-10', '2026-10-09', '2026-10-08', '2026-10-06'), 4, NOON)
      expect(m.stats.streak).toBe(3)
      expect(m.todayEntry?.entry_date).toBe('2026-10-10')
    })

    it('今日がまだでも、昨日まで続いていれば途切れない', () => {
      const m = buildHomeModel(entries('2026-10-09', '2026-10-08'), 2, NOON)
      expect(m.stats.streak).toBe(2)
      expect(m.todayEntry).toBeNull()
    })

    it('昨日も書いていなければ 0', () => {
      const m = buildHomeModel(entries('2026-10-08', '2026-10-07'), 2, NOON)
      expect(m.stats.streak).toBe(0)
    })

    it('月・年をまたいでも数える', () => {
      const now = new Date('2026-01-02T03:00:00Z') // 2026-01-02 12:00 JST
      const m = buildHomeModel(entries('2026-01-02', '2026-01-01', '2025-12-31', '2025-12-30'), 4, now)
      expect(m.stats.streak).toBe(4)
    })

    it('記録が無ければ 0', () => {
      expect(buildHomeModel([], 0, NOON).stats.streak).toBe(0)
    })
  })

  describe('昨日を書けば戻る連続（restorable）', () => {
    it('昨日だけ空いていて今日もまだなら、昨日＋一昨日までの連続', () => {
      // 10/8・10/7・10/6 と続いて、10/9（昨日）が空き
      const m = buildHomeModel(entries('2026-10-08', '2026-10-07', '2026-10-06'), 3, NOON)
      expect(m.stats.streak).toBe(0)
      expect(m.stats.restorable).toBe(4)
    })

    it('今日を書いていて昨日だけ空いているなら、今日の分も足す', () => {
      const m = buildHomeModel(entries('2026-10-10', '2026-10-08', '2026-10-07'), 3, NOON)
      expect(m.stats.streak).toBe(1)
      expect(m.stats.restorable).toBe(4)
    })

    it('昨日を書いていれば null', () => {
      expect(buildHomeModel(entries('2026-10-09', '2026-10-08'), 2, NOON).stats.restorable).toBeNull()
    })

    it('一昨日も空いていれば（昨日を書いても1日だけ）null', () => {
      expect(buildHomeModel(entries('2026-10-07', '2026-10-06'), 2, NOON).stats.restorable).toBeNull()
      expect(buildHomeModel([], 0, NOON).stats.restorable).toBeNull()
    })
  })

  describe('いちばん長く続いた日数（longest）', () => {
    it('途中で途切れても、いちばん長い連続を返す', () => {
      const list = entries('2026-10-10', '2026-10-05', '2026-10-04', '2026-10-03', '2026-09-30', '2026-09-29')
      expect(buildHomeModel(list, list.length, NOON).stats.longest).toBe(3)
    })

    it('月をまたぐ連続も数え、記録が無ければ 0', () => {
      const list = entries('2026-10-02', '2026-10-01', '2026-09-30', '2026-09-29')
      expect(buildHomeModel(list, list.length, NOON).stats.longest).toBe(4)
      expect(buildHomeModel([], 0, NOON).stats.longest).toBe(0)
    })

    it('未来の日付が混ざっていても、今日・昨日からの連続はずれない', () => {
      const m = buildHomeModel(entries('2026-10-12', '2026-10-10', '2026-10-09'), 3, NOON)
      expect(m.stats.streak).toBe(2)
    })
  })

  describe('昨日の書き忘れ', () => {
    it('昨日が空で、それより前に記録があれば true', () => {
      expect(buildHomeModel(entries('2026-10-10', '2026-10-08'), 2, NOON).missedYesterday).toBe(true)
      expect(buildHomeModel(entries('2026-10-01'), 1, NOON).missedYesterday).toBe(true)
    })

    it('昨日を書いていれば false', () => {
      expect(buildHomeModel(entries('2026-10-09', '2026-10-08'), 2, NOON).missedYesterday).toBe(false)
    })

    it('はじめて使う人（それより前の記録が無い）には出さない', () => {
      expect(buildHomeModel([], 0, NOON).missedYesterday).toBe(false)
      expect(buildHomeModel(entries('2026-10-10'), 1, NOON).missedYesterday).toBe(false)
    })
  })

  describe('ふり返り（一年前・ひと月前の今日）', () => {
    it('ちょうど 365 日前と 30 日前の記録を、この順で出す', () => {
      const list = entries('2026-10-10', '2026-09-10', '2025-10-10', '2025-10-11')
      const m = buildHomeModel(list, list.length, NOON)
      expect(m.flashbacks.map((f) => [f.label, f.entry.entry_date])).toEqual([
        ['一年前の今日', '2025-10-10'],
        ['ひと月前の今日', '2026-09-10'],
      ])
    })

    it('記録が無い方は出さない', () => {
      const m = buildHomeModel(entries('2026-09-10'), 1, NOON)
      expect(m.flashbacks.map((f) => f.label)).toEqual(['ひと月前の今日'])
      expect(buildHomeModel(entries('2026-09-11'), 1, NOON).flashbacks).toEqual([])
    })
  })

  it('平均気分は小数1桁に丸める', () => {
    const list = [entry('2026-10-10', 5), entry('2026-10-09', 4), entry('2026-10-08', 4)]
    expect(buildHomeModel(list, 3, NOON).stats.avgMood).toBe(4.3)
    expect(buildHomeModel([entry('2026-10-10', 4), entry('2026-10-09', 3)], 2, NOON).stats.avgMood).toBe(3.5)
    expect(buildHomeModel([], 0, NOON).stats.avgMood).toBe(0)
  })

  it('総数は渡された値をそのまま使い、最近の記録は5件まで', () => {
    const list = entries('2026-10-10', '2026-10-09', '2026-10-08', '2026-10-07', '2026-10-06', '2026-10-05')
    const m = buildHomeModel(list, 120, NOON)
    expect(m.stats.total).toBe(120)
    expect(m.entries).toBe(list)
    expect(m.recentEntries.map((e) => e.entry_date)).toEqual([
      '2026-10-10',
      '2026-10-09',
      '2026-10-08',
      '2026-10-07',
      '2026-10-06',
    ])
  })
})
