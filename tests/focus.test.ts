import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEYS } from '@/lib/constants'
import { doneInLastWeek, isFocusActive, loadFocus, saveFocus, toggleDone, type Focus } from '@/lib/focus'

const focus = (adoptedAt: string, doneDates: string[] = []): Focus => ({ text: '朝に10分歩く', adoptedAt, doneDates })

describe('isFocusActive', () => {
  it('採用していなければ false', () => {
    expect(isFocusActive(null, '2026-10-10')).toBe(false)
  })

  it('採用から14日間（当日を含む）はホームに出す', () => {
    expect(isFocusActive(focus('2026-10-10'), '2026-10-10')).toBe(true)
    expect(isFocusActive(focus('2026-09-26'), '2026-10-10')).toBe(true) // 14 日後
    expect(isFocusActive(focus('2026-09-25'), '2026-10-10')).toBe(false) // 15 日後
  })

  it('月・年をまたいでも日数で数える', () => {
    expect(isFocusActive(focus('2025-12-20'), '2026-01-03')).toBe(true)
    expect(isFocusActive(focus('2025-12-19'), '2026-01-03')).toBe(false)
  })
})

describe('doneInLastWeek', () => {
  it('今日を含む直近7日に実施した日だけ数える', () => {
    const f = focus('2026-09-30', ['2026-10-10', '2026-10-04', '2026-10-03', '2026-10-11', '2026-09-30'])
    // 10-10（今日）と 10-04（6日前）だけ。10-03 は7日前、10-11 は未来
    expect(doneInLastWeek(f, '2026-10-10')).toBe(2)
  })

  it('記録が無ければ 0', () => {
    expect(doneInLastWeek(focus('2026-10-10'), '2026-10-10')).toBe(0)
  })
})

describe('toggleDone', () => {
  it('実施した日を足し、もう一度押すと外す', () => {
    const f = focus('2026-10-01', ['2026-10-08'])
    const added = toggleDone(f, '2026-10-10')
    expect(added.doneDates).toEqual(['2026-10-08', '2026-10-10'])
    const removed = toggleDone(added, '2026-10-10')
    expect(removed.doneDates).toEqual(['2026-10-08'])
  })

  it('元のオブジェクトは変えない', () => {
    const f = focus('2026-10-01', ['2026-10-08'])
    toggleDone(f, '2026-10-10')
    expect(f.doneDates).toEqual(['2026-10-08'])
  })

  it('記録は新しい30件までに打ち切る', () => {
    const dates = Array.from({ length: 30 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`)
    const next = toggleDone(focus('2026-09-01', dates), '2026-10-01')
    expect(next.doneDates).toHaveLength(30)
    expect(next.doneDates[0]).toBe('2026-09-02')
    expect(next.doneDates[29]).toBe('2026-10-01')
  })
})

describe('loadFocus / saveFocus', () => {
  let store: Map<string, string>

  beforeEach(() => {
    store = new Map()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('保存したものを読み戻せる', () => {
    const f = focus('2026-10-01', ['2026-10-02'])
    saveFocus(f)
    expect(JSON.parse(store.get(STORAGE_KEYS.FOCUS) ?? '')).toEqual(f)
    expect(loadFocus()).toEqual(f)
  })

  it('null を保存すると消す', () => {
    saveFocus(focus('2026-10-01'))
    saveFocus(null)
    expect(store.has(STORAGE_KEYS.FOCUS)).toBe(false)
    expect(loadFocus()).toBeNull()
  })

  it('壊れた値は読まない', () => {
    for (const raw of ['{', 'null', '{"text":"","adoptedAt":"2026-10-01"}', '{"text":"歩く"}']) {
      store.set(STORAGE_KEYS.FOCUS, raw)
      expect(loadFocus(), raw).toBeNull()
    }
  })

  it('実施日のうち文字列でないものは捨てる', () => {
    store.set(STORAGE_KEYS.FOCUS, JSON.stringify({ text: '歩く', adoptedAt: '2026-10-01', doneDates: ['2026-10-02', 3, null] }))
    expect(loadFocus()).toEqual({ text: '歩く', adoptedAt: '2026-10-01', doneDates: ['2026-10-02'] })
    store.set(STORAGE_KEYS.FOCUS, JSON.stringify({ text: '歩く', adoptedAt: '2026-10-01' }))
    expect(loadFocus()?.doneDates).toEqual([])
  })

  it('localStorage が使えない環境でも落ちない', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('denied')
      },
      removeItem: () => {
        throw new Error('denied')
      },
    })
    expect(loadFocus()).toBeNull()
    expect(() => saveFocus(focus('2026-10-01'))).not.toThrow()
    expect(() => saveFocus(null)).not.toThrow()
  })
})
