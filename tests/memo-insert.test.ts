import { describe, expect, it } from 'vitest'
import { appendLinesWithin, memosUsedIn } from '@/lib/memo-insert'

const MAX = 500
const line = (n: number, len: number) => `・1${n}:00 ${`メモ${n}`.padEnd(len, 'あ')}`

describe('appendLinesWithin（ひとこと・予定を「今日あったこと」に入れる）', () => {
  it('上限に収まるなら、すべての行を改行でつなぐ（前の文の末尾の空白は落とす）', () => {
    expect(appendLinesWithin('朝ジム\n', ['・09:00 会議', '・12:00 ランチ'], MAX)).toEqual({
      text: '朝ジム\n・09:00 会議\n・12:00 ランチ',
      added: 2,
      skipped: 0,
    })
    expect(appendLinesWithin('', ['・09:00 会議'], MAX)).toEqual({ text: '・09:00 会議', added: 1, skipped: 0 })
  })

  it('上限を超える行は途中で切らずに入れない（以前は 500 字で黙って切っていた）', () => {
    // 100字のメモ6件（以前は 5 件目の途中から後ろが消えた）
    const lines = Array.from({ length: 6 }, (_, i) => line(i + 1, 100))
    const r = appendLinesWithin('', lines, MAX)
    expect(r.text.length).toBeLessThanOrEqual(MAX)
    expect(r.added).toBe(4)
    expect(r.skipped).toBe(2)
    // 入った行は一字も欠けず、入らなかった行はかけらも入らない
    for (const l of lines.slice(0, 4)) expect(r.text).toContain(l)
    expect(r.text).not.toContain('メモ5')
    expect(r.text).not.toContain('メモ6')
  })

  it('入らない長い行は飛ばして、あとの短い行は入れる', () => {
    const r = appendLinesWithin('あ'.repeat(400), [line(1, 150), '・18:00 散歩'], MAX)
    expect(r.added).toBe(1)
    expect(r.skipped).toBe(1)
    expect(r.text.endsWith('\n・18:00 散歩')).toBe(true)
  })

  it('1行も入らなければ、元の文をそのまま返す', () => {
    const base = `${'あ'.repeat(495)}\n`
    expect(appendLinesWithin(base, [line(1, 20)], MAX)).toEqual({ text: base, added: 0, skipped: 1 })
  })
})

describe('memosUsedIn（保存のあとに片付けてよいメモ）', () => {
  const memos = [
    { id: 'a', text: '会議で前提を確認されなかった' },
    { id: 'b', text: '帰りに金木犀の香り' },
    { id: 'c', text: '夕飯はカレー' },
  ]

  it('日記に入ったメモだけを返す（入らなかった・選ばなかったメモは残す）', () => {
    const saved = '・10:00 会議で前提を確認されなかった\n・19:30 夕飯はカレー'
    expect(memosUsedIn(memos, saved).map((m) => m.id)).toEqual(['a', 'c'])
  })

  it('入れたあとに行を消したメモは片付けない', () => {
    expect(memosUsedIn(memos, '朝ジム')).toEqual([])
  })

  it('空のメモは対象にしない', () => {
    expect(memosUsedIn([{ id: 'x', text: '  ' }], 'なんでも')).toEqual([])
  })
})
