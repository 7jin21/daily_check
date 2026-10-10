import { describe, expect, it } from 'vitest'
import { appendLaterNote, parseFreeform, splitFreeformMemo, withReflection, type FreeformParts } from '@/lib/freeform'

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

describe('splitFreeformMemo', () => {
  it('空・null・undefined は両方空', () => {
    expect(splitFreeformMemo(null)).toEqual({ memo: '', rest: '' })
    expect(splitFreeformMemo(undefined)).toEqual({ memo: '', rest: '' })
    expect(splitFreeformMemo('')).toEqual({ memo: '', rest: '' })
  })

  it('印が無ければ全体がメモ（空白・改行も詰めない）', () => {
    expect(splitFreeformMemo('  ただのメモ\n2行目  \n')).toEqual({ memo: '  ただのメモ\n2行目  \n', rest: '' })
  })

  it('印から始まればメモは空で、全体が rest', () => {
    expect(splitFreeformMemo('【ふりかえり】Q\n→ A')).toEqual({ memo: '', rest: '【ふりかえり】Q\n→ A' })
    expect(splitFreeformMemo('【あとから 2026-10-12】一言')).toEqual({ memo: '', rest: '【あとから 2026-10-12】一言' })
  })

  it('メモのあとに印があれば、最初の印の手前で分ける（後ろの印はすべて rest に残す）', () => {
    expect(splitFreeformMemo(FULL)).toEqual({
      memo: '朝ジム。夜はラーメン\n\n',
      rest: FULL.slice(FULL.indexOf('【ふりかえり】')),
    })
  })

  it('「あとから」の印でも分ける', () => {
    expect(splitFreeformMemo('メモ\n\n【あとから 2026-10-12】今の一言\n\n【ふりかえり】Q\n→ A')).toEqual({
      memo: 'メモ\n\n',
      rest: '【あとから 2026-10-12】今の一言\n\n【ふりかえり】Q\n→ A',
    })
  })

  it('印は欄の先頭か空行の直後にあるものだけ（文の途中・改行1つのあとは本人の文字として扱う）', () => {
    expect(splitFreeformMemo('メモ【ふりかえり】続き')).toEqual({ memo: 'メモ【ふりかえり】続き', rest: '' })
    expect(splitFreeformMemo('メモ\n【あとから 2026-10-12】続き')).toEqual({ memo: 'メモ\n【あとから 2026-10-12】続き', rest: '' })
    expect(parseFreeform('会議メモ【ふりかえり】は明日やる')).toEqual({ memo: '会議メモ【ふりかえり】は明日やる', reflections: [], laterNotes: [] })
    // アプリが書く形（空行のあと）は印として読む
    expect(parseFreeform('メモ\n\n【ふりかえり】Q\n→ A').reflections).toEqual([{ question: 'Q', answer: 'A' }])
  })

  it('日付の形でない「あとから」は印として扱わない', () => {
    expect(splitFreeformMemo('【あとから 明日】続き\n\n【ふりかえり】Q\n→ A')).toEqual({
      memo: '【あとから 明日】続き\n\n',
      rest: '【ふりかえり】Q\n→ A',
    })
  })

  it('保存された文字列をそのまま切り出す（memo + rest で元に戻る・組み直さない）', () => {
    for (const raw of [
      FULL,
      '  メモ  \n\n\n【ふりかえり】  Q \n→  A  \n',
      'メモ【ふりかえり】',
      '【ふりかえり】\n\n【あとから 2026-10-12】  ',
      '【あとから 2026-10-12】一言【ふりかえり】が入った一言',
      '印の無いメモ',
    ]) {
      const { memo, rest } = splitFreeformMemo(raw)
      expect(memo + rest, JSON.stringify(raw)).toBe(raw)
      // メモの側には（先頭か空行の直後の）印が残らない（最初の印で切っている）
      expect(splitFreeformMemo(memo).rest, JSON.stringify(raw)).toBe('')
    }
  })
})

describe('withReflection', () => {
  it('答えがあればメモのあとに問いと答えを畳む', () => {
    expect(withReflection('メモ', '一番引っかかったのは？', '前提 — 確認されなかった')).toBe(
      'メモ\n\n【ふりかえり】一番引っかかったのは？\n→ 前提 — 確認されなかった'
    )
  })

  it('メモは書いたまま残す（前後の空白・改行を詰めない）', () => {
    expect(withReflection('　今日は\n', 'Q', 'A')).toBe('　今日は\n\n\n【ふりかえり】Q\n→ A')
    expect(withReflection(' メモ ', 'Q', 'A')).toBe(' メモ \n\n【ふりかえり】Q\n→ A')
  })

  it('メモが空なら問いと答えだけ', () => {
    expect(withReflection('', 'Q', 'A')).toBe('【ふりかえり】Q\n→ A')
  })

  it('答えが空ならメモをそのまま返す（問いだけは残さない）', () => {
    expect(withReflection('メモ ', 'Q', '')).toBe('メモ ')
    expect(withReflection('メモ', 'Q', '   ')).toBe('メモ')
    expect(withReflection('　今日は\n', 'Q', '\n')).toBe('　今日は\n')
    expect(withReflection('', 'Q', '')).toBe('')
  })

  it('答えも書いたまま畳む', () => {
    expect(withReflection('メモ', 'Q', ' A ')).toBe('メモ\n\n【ふりかえり】Q\n→  A ')
  })

  it('畳んだものは parseFreeform で取り出せる', () => {
    expect(parseFreeform(withReflection('メモ', 'Q', 'A'))).toEqual({
      memo: 'メモ',
      reflections: [{ question: 'Q', answer: 'A' }],
      laterNotes: [],
    })
  })

  it('畳んだものは splitFreeformMemo でメモとふりかえりに分かれる', () => {
    expect(splitFreeformMemo(withReflection('　今日は\n', 'Q', 'A'))).toEqual({
      memo: '　今日は\n\n\n',
      rest: '【ふりかえり】Q\n→ A',
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
