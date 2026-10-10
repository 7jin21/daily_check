import { describe, expect, it } from 'vitest'
import { appendLaterNote, parseFreeform, serializeFreeform, withReflection, type FreeformParts } from '@/lib/freeform'

const FULL = [
  '朝ジム。夜はラーメン',
  '【ふりかえり】一番引っかかったのは？\n→ 前提を確認されなかったこと',
  '【ふりかえり】誰に一番感謝したい？\n→ 同僚 — 手伝ってくれた',
  '【あとから 2026-10-12】今思うと大したことなかった',
  '【あとから 2026-10-20】また同じことがあった',
].join('\n\n')

describe('parseFreeform', () => {
  it('空・null・undefined は空の部品', () => {
    const empty: FreeformParts = { memo: '', reflections: [], laterNotes: [] }
    expect(parseFreeform(null)).toEqual(empty)
    expect(parseFreeform(undefined)).toEqual(empty)
    expect(parseFreeform('')).toEqual(empty)
  })

  it('印が無ければ全体がメモ', () => {
    expect(parseFreeform('  ただのメモ\n2行目  ')).toEqual({ memo: 'ただのメモ\n2行目', reflections: [], laterNotes: [] })
  })

  it('メモ・ふりかえり・あとからの一言に分ける', () => {
    expect(parseFreeform(FULL)).toEqual({
      memo: '朝ジム。夜はラーメン',
      reflections: [
        { question: '一番引っかかったのは？', answer: '前提を確認されなかったこと' },
        { question: '誰に一番感謝したい？', answer: '同僚 — 手伝ってくれた' },
      ],
      laterNotes: [
        { date: '2026-10-12', text: '今思うと大したことなかった' },
        { date: '2026-10-20', text: 'また同じことがあった' },
      ],
    })
  })

  it('メモが無くても印から読める', () => {
    expect(parseFreeform('【ふりかえり】問い\n→ 答え')).toEqual({
      memo: '',
      reflections: [{ question: '問い', answer: '答え' }],
      laterNotes: [],
    })
  })

  it('答えの無いふりかえりは問いだけ', () => {
    expect(parseFreeform('【ふりかえり】問いだけ').reflections).toEqual([{ question: '問いだけ', answer: '' }])
  })

  it('答えの中の「→」は答えの一部として残す', () => {
    expect(parseFreeform('【ふりかえり】問い\n→ A\n→ B').reflections).toEqual([{ question: '問い', answer: 'A\n→ B' }])
  })

  it('中身の無い印は捨てる', () => {
    expect(parseFreeform('メモ\n\n【ふりかえり】\n\n【あとから 2026-10-12】  ')).toEqual({
      memo: 'メモ',
      reflections: [],
      laterNotes: [],
    })
  })

  it('日付の形でない「あとから」は印として扱わない', () => {
    expect(parseFreeform('【あとから 明日】メモの続き')).toEqual({
      memo: '【あとから 明日】メモの続き',
      reflections: [],
      laterNotes: [],
    })
  })
})

describe('serializeFreeform', () => {
  it('parse → serialize で元に戻る', () => {
    expect(serializeFreeform(parseFreeform(FULL))).toBe(FULL)
  })

  it('serialize → parse でも部品が保たれる', () => {
    const parts: FreeformParts = {
      memo: 'メモ',
      reflections: [{ question: 'Q', answer: 'A' }],
      laterNotes: [{ date: '2026-10-11', text: 'あとで' }],
    }
    expect(parseFreeform(serializeFreeform(parts))).toEqual(parts)
  })

  it('順番は メモ → ふりかえり → あとからの一言', () => {
    expect(
      serializeFreeform({
        memo: 'メモ',
        reflections: [{ question: 'Q', answer: 'A' }],
        laterNotes: [{ date: '2026-10-11', text: 'あとで' }],
      })
    ).toBe('メモ\n\n【ふりかえり】Q\n→ A\n\n【あとから 2026-10-11】あとで')
  })

  it('空の部品は書き出さない', () => {
    expect(
      serializeFreeform({
        memo: '  ',
        reflections: [
          { question: '', answer: '' },
          { question: '問いだけ', answer: ' ' },
        ],
        laterNotes: [{ date: '2026-10-11', text: '  ' }],
      })
    ).toBe('【ふりかえり】問いだけ')
    expect(serializeFreeform({ memo: '', reflections: [], laterNotes: [] })).toBe('')
  })
})

describe('withReflection', () => {
  it('答えがあればメモのあとに問いと答えを畳む', () => {
    expect(withReflection('メモ', '一番引っかかったのは？', '前提 — 確認されなかった')).toBe(
      'メモ\n\n【ふりかえり】一番引っかかったのは？\n→ 前提 — 確認されなかった'
    )
  })

  it('メモが空なら問いと答えだけ', () => {
    expect(withReflection('', 'Q', 'A')).toBe('【ふりかえり】Q\n→ A')
  })

  it('答えが空ならメモをそのまま返す（問いだけは残さない）', () => {
    expect(withReflection('メモ ', 'Q', '')).toBe('メモ ')
    expect(withReflection('メモ', 'Q', '   ')).toBe('メモ')
  })

  it('畳んだものは parseFreeform で取り出せる', () => {
    expect(parseFreeform(withReflection('メモ', 'Q', 'A'))).toEqual({
      memo: 'メモ',
      reflections: [{ question: 'Q', answer: 'A' }],
      laterNotes: [],
    })
  })
})

describe('appendLaterNote', () => {
  it('当時の本文は変えずに末尾へ足す', () => {
    expect(appendLaterNote('メモ\n\n【ふりかえり】Q\n→ A', '2026-10-12', '今の一言')).toBe(
      'メモ\n\n【ふりかえり】Q\n→ A\n\n【あとから 2026-10-12】今の一言'
    )
  })

  it('本文が空・null なら一言だけ', () => {
    expect(appendLaterNote(null, '2026-10-12', ' 今の一言 ')).toBe('【あとから 2026-10-12】今の一言')
    expect(appendLaterNote(undefined, '2026-10-12', 'a')).toBe('【あとから 2026-10-12】a')
    expect(appendLaterNote('  \n', '2026-10-12', 'a')).toBe('【あとから 2026-10-12】a')
  })

  it('末尾の空白・改行は詰めてから足す', () => {
    expect(appendLaterNote('メモ\n\n\n', '2026-10-12', 'a')).toBe('メモ\n\n【あとから 2026-10-12】a')
  })

  it('何度足しても、すべての一言が読める', () => {
    const once = appendLaterNote('メモ', '2026-10-12', '一つ目')
    const twice = appendLaterNote(once, '2026-10-20', '二つ目')
    expect(parseFreeform(twice)).toEqual({
      memo: 'メモ',
      reflections: [],
      laterNotes: [
        { date: '2026-10-12', text: '一つ目' },
        { date: '2026-10-20', text: '二つ目' },
      ],
    })
  })
})
