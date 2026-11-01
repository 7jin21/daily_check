import { describe, expect, it } from 'vitest'
import { markSaveEcho, takeSaveEcho } from '@/lib/save-echo'

function memoryStore() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    size: () => m.size,
  }
}

const NOW = Date.parse('2026-11-01T12:00:00Z')

describe('保存した直後の目印（save-echo）', () => {
  it('残した目印を一度だけ読める', () => {
    const store = memoryStore()
    markSaveEcho('2026-11-01', 4, NOW, store)
    expect(takeSaveEcho(NOW + 1000, store)).toEqual({ date: '2026-11-01', mood: 4, at: NOW })
    expect(takeSaveEcho(NOW + 2000, store)).toBeNull()
    expect(store.size()).toBe(0)
  })

  it('気分が無い・範囲外なら「普通」として残す', () => {
    const store = memoryStore()
    markSaveEcho('2026-11-01', null, NOW, store)
    expect(takeSaveEcho(NOW, store)?.mood).toBe(3)
    markSaveEcho('2026-11-01', 9, NOW, store)
    expect(takeSaveEcho(NOW, store)?.mood).toBe(3)
  })

  it('10分より古い目印は使わない（あとで開いたホームで急に演出を出さない）', () => {
    const store = memoryStore()
    markSaveEcho('2026-11-01', 5, NOW, store)
    expect(takeSaveEcho(NOW + 11 * 60 * 1000, store)).toBeNull()
    expect(store.size()).toBe(0)
  })

  it('壊れた値は捨てる', () => {
    const store = memoryStore()
    store.setItem('inner-mirror-save-echo', '{"date":"11/1","mood":3,"at":0}')
    expect(takeSaveEcho(NOW, store)).toBeNull()
    store.setItem('inner-mirror-save-echo', 'not json')
    expect(takeSaveEcho(NOW, store)).toBeNull()
  })

  it('保存先が無い環境では何もしない', () => {
    expect(() => markSaveEcho('2026-11-01', 3, NOW, null)).not.toThrow()
    expect(takeSaveEcho(NOW, null)).toBeNull()
  })
})
