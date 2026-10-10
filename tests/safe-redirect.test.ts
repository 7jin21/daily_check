import { describe, expect, it } from 'vitest'
import { safeNextPath } from '@/lib/safe-redirect'

describe('safeNextPath', () => {
  it('サイト内のパスはそのまま返す（クエリ・ハッシュも残す）', () => {
    expect(safeNextPath('/')).toBe('/')
    expect(safeNextPath('/entries')).toBe('/entries')
    expect(safeNextPath('/checkin?date=2026-10-09')).toBe('/checkin?date=2026-10-09')
    expect(safeNextPath('/entries/abc#later')).toBe('/entries/abc#later')
  })

  it('外部サイトへ飛ばせる形は fallback にする', () => {
    for (const next of [
      '//evil.com',
      '//evil.com/path',
      '@evil.com',
      '/\\evil.com',
      '\\\\evil.com',
      '/\t/evil.com',
      '/\n/evil.com',
      'https://evil.com',
      'javascript:alert(1)',
      'entries',
    ]) {
      expect(safeNextPath(next), JSON.stringify(next)).toBe('/')
    }
  })

  it('値が無いときは fallback', () => {
    expect(safeNextPath(null)).toBe('/')
    expect(safeNextPath(undefined)).toBe('/')
    expect(safeNextPath('')).toBe('/')
  })

  it('fallback を指定できる', () => {
    expect(safeNextPath(null, '/entries')).toBe('/entries')
    expect(safeNextPath('//evil.com', '/checkin')).toBe('/checkin')
  })

  it('文字列でない値は fallback（クエリの配列などが渡っても落ちない）', () => {
    expect(safeNextPath(['/entries'] as unknown as string)).toBe('/')
  })

  it('返すパスは正規化されている（同じサイトの中にとどまる）', () => {
    expect(safeNextPath('/a/../entries')).toBe('/entries')
    expect(safeNextPath('/../../entries')).toBe('/entries')
  })
})
