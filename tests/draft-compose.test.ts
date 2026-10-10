import { describe, expect, it } from 'vitest'
import { analyzeKept, composeBullets, composeRaw, DRAFT_MODES, inputKey, type ComposeInput } from '@/lib/draft-compose'

const base: ComposeInput = { mood: 3, energy: 3, events: '', challenges: '', gratitude: '', freeform: '' }

/** 区間をつなぐと清書の本文に戻る（文字を落としていない）ことも毎回確かめる */
function analyze(original: string, draft: string, aiSource?: string) {
  const r = analyzeKept(original, draft, aiSource)
  expect(r.segments.map((s) => s.text).join('')).toBe(draft)
  return r
}

describe('analyzeKept', () => {
  it('つなぎの助詞「で」だけ足した清書は 100% 本人の言葉', () => {
    const r = analyze('会議 疲れた', '会議で疲れた。')
    expect(r.own).toBe(1)
    expect(r.kept).toBe(1)
    expect(r.addedChars).toBe(0)
    expect(r.segments).toEqual([
      { text: '会議', added: false, connector: false },
      { text: 'で', added: true, connector: true },
      { text: '疲れた。', added: false, connector: false },
    ])
  })

  it('AI が文を水増しすると、メモが全部残っていても own は下がる', () => {
    const r = analyze('会議 疲れた', '今日は会議があって、とても疲れた一日だった。明日も頑張ろう。')
    expect(r.kept).toBe(1) // メモは削られていない
    expect(r.addedChars).toBe(22) // 今日は・があって・とても・一日だった・明日も頑張ろう
    expect(r.own).toBeCloseTo(5 / 27, 6) // 記号を除いた 27 文字のうち本人の言葉は 5 文字
    expect(r.own).toBeCloseTo(0.19, 2)
    const added = r.segments.filter((s) => s.added).map((s) => s.text)
    expect(added).toEqual(['今日は', 'があって', 'とても', '一日だった', '明日も頑張ろう'])
    expect(r.segments.some((s) => s.connector)).toBe(false)
  })

  it('語尾の書き換え（嬉しい → 嬉しかった）は AI の言葉として数える', () => {
    const r = analyze('上司に褒められて嬉しい', '上司に褒められて嬉しかった。')
    expect(r.addedChars).toBe(3)
    const added = r.segments.filter((s) => s.added)
    expect(added).toEqual([{ text: 'かった', added: true, connector: false }]) // 3 文字なのでつなぎではない
    expect(r.own).toBeCloseTo(1 - 3 / 13, 6)
    expect(r.kept).toBeLessThan(1) // 「しい」が消えている
  })

  it('句の途中に挟んだ助詞「は」はつなぎとして扱う', () => {
    const r = analyze('朝ジム。仕事は資料づくり。夜はラーメン', '朝はジム。仕事は資料づくり。夜はラーメン。')
    expect(r.own).toBe(1)
    expect(r.kept).toBe(1)
    expect(r.addedChars).toBe(0)
    expect(r.segments).toEqual([
      { text: '朝', added: false, connector: false },
      { text: 'は', added: true, connector: true },
      { text: 'ジム。仕事は資料づくり。夜はラーメン。', added: false, connector: false },
    ])
  })

  it('メモと同じ文なら全部本人の言葉', () => {
    const text = '朝ジム。仕事は資料づくり。'
    const r = analyze(text, text)
    expect(r).toEqual({
      segments: [{ text, added: false, connector: false }],
      own: 1,
      kept: 1,
      addedChars: 0,
    })
  })

  it('句読点・空白・改行を足しただけでは減点しない', () => {
    const r = analyze('朝ジム 仕事は資料づくり', '朝ジム。\n\n仕事は、資料づくり！')
    expect(r.own).toBe(1)
    expect(r.kept).toBe(1)
    expect(r.segments.every((s) => !s.added)).toBe(true)
  })

  it('清書が空なら AI の言葉は無いが、メモは残っていない', () => {
    const r = analyze('会議 疲れた', '')
    expect(r).toEqual({ segments: [], own: 1, kept: 0, addedChars: 0 })
  })

  it('メモも清書も空なら 100%', () => {
    expect(analyze('', '')).toEqual({ segments: [], own: 1, kept: 1, addedChars: 0 })
  })

  it('メモの一部が削られると kept が下がる（own は下がらない）', () => {
    const r = analyze('会議 疲れた 散歩した', '会議で疲れた。')
    expect(r.own).toBe(1)
    expect(r.kept).toBe(0.5) // 単位: 会議・疲れた・散歩し・歩した のうち 2 つ
  })

  it('メモと関係ない文だけなら own は 0', () => {
    const r = analyze('会議 疲れた', '素晴らしい一日でした')
    expect(r.own).toBe(0)
    expect(r.kept).toBe(0)
    expect(r.addedChars).toBe(10)
  })

  it('割合は 0〜1 に収まる', () => {
    const cases: [string, string][] = [
      ['あ', 'ああああああ'],
      ['会議', '会議会議会議'],
      ['😀 絵文字', '😀絵文字です'],
    ]
    for (const [a, b] of cases) {
      const r = analyze(a, b)
      expect(r.own).toBeGreaterThanOrEqual(0)
      expect(r.own).toBeLessThanOrEqual(1)
      expect(r.kept).toBeGreaterThanOrEqual(0)
      expect(r.kept).toBeLessThanOrEqual(1)
    }
  })
})

describe('analyzeKept（aiSource: この下書きで AI が出した文章）', () => {
  const AI_DRAFT = '今日は会議があって、とても疲れた一日だった。'
  const USER_TYPED = '帰りに夕焼けを見た。'

  it('下書き画面で本人が書き足した文（AI の文章に無い）は本人の言葉として数える', () => {
    const r = analyze('会議 疲れた', `会議で疲れた。${USER_TYPED}`, '会議で疲れた。')
    expect(r.own).toBe(1)
    expect(r.addedChars).toBe(0)
    expect(r.kept).toBe(1)
    expect(r.segments).toEqual([
      { text: '会議', added: false, connector: false },
      { text: 'で', added: true, connector: true },
      { text: `疲れた。${USER_TYPED}`, added: false, connector: false },
    ])
  })

  it('AI の文章にある水増しは、aiSource を渡しても AI の言葉として数える', () => {
    const r = analyze('会議 疲れた', AI_DRAFT, AI_DRAFT)
    const without = analyze('会議 疲れた', AI_DRAFT)
    expect(r.addedChars).toBe(22 - 7) // 「明日も頑張ろう」の無い分
    expect(r).toEqual(without)
    expect(r.segments.filter((s) => s.added).map((s) => s.text)).toEqual(['今日は', 'があって', 'とても', '一日だった'])
  })

  it('AI の水増しと本人の書き足しが混ざっていれば、AI の分だけ数える', () => {
    const draft = `${AI_DRAFT}${USER_TYPED}`
    const r = analyze('会議 疲れた', draft, AI_DRAFT)
    expect(r.addedChars).toBe(15) // 今日は・があって・とても・一日だった
    expect(r.own).toBeCloseTo(1 - 15 / 29, 6) // 記号を除いた 29 文字のうち AI の言葉は 15 文字
    expect(r.kept).toBe(1)
    expect(r.segments.filter((s) => s.added).map((s) => s.text)).toEqual(['今日は', 'があって', 'とても', '一日だった'])
    expect(r.segments[r.segments.length - 1]).toEqual({ text: `。${USER_TYPED}`, added: false, connector: false })

    // aiSource が無ければ、本人の書き足しも AI の言葉として数えていた（以前のふるまい）
    const without = analyze('会議 疲れた', draft)
    expect(without.addedChars).toBe(15 + 9)
    expect(without.own).toBeLessThan(r.own)
  })

  it('AI を使っていない（aiSource が空）なら、書き足した言葉があっても 100% 本人の言葉', () => {
    const draft = `会議 疲れた\n\n${USER_TYPED}`
    const r = analyze('会議 疲れた', draft, '')
    expect(r).toEqual({
      segments: [{ text: draft, added: false, connector: false }],
      own: 1,
      kept: 1,
      addedChars: 0,
    })
  })

  it('aiSource が無ければ、メモに無い言葉はすべて AI の言葉（以前のふるまい）', () => {
    const r = analyze('会議 疲れた', `会議で疲れた。${USER_TYPED}`)
    expect(r.addedChars).toBe(9)
    expect(r.own).toBeCloseTo(1 - 9 / 15, 6)
    expect(r.segments.filter((s) => s.added).map((s) => s.text)).toEqual(['で', '帰りに夕焼けを見た'])
  })

  it('kept（メモが残った割合）は aiSource で変わらない', () => {
    const draft = `会議で疲れた。${USER_TYPED}`
    expect(analyze('会議 疲れた 散歩した', draft, '会議で疲れた。').kept).toBe(0.5)
    expect(analyze('会議 疲れた 散歩した', draft).kept).toBe(0.5)
  })
})

describe('composeRaw', () => {
  it('書いた欄だけを段落で並べる（前後の空白は落とす）', () => {
    expect(composeRaw({ ...base, events: ' 会議 疲れた ', gratitude: '友達がコーヒーをくれた' })).toBe(
      '会議 疲れた\n\n友達がコーヒーをくれた'
    )
  })

  it('欄の順番は 出来事 → 困ったこと → 感謝 → 自由メモ → ふりかえりの答え', () => {
    const input: ComposeInput = {
      ...base,
      freeform: 'D',
      gratitude: 'C',
      challenges: 'B',
      events: 'A',
      reflectionQ: '問い',
      reflectionA: 'E',
    }
    expect(composeRaw(input)).toBe('A\n\nB\n\nC\n\nD\n\nE')
  })

  it('ふりかえりの答え「選択肢 — 一言」は句点でつなぐ（問いは本文に入れない）', () => {
    const input: ComposeInput = { ...base, events: '会議', reflectionQ: '一番引っかかったのは？', reflectionA: '前提の確認 — 言えばよかった' }
    expect(composeRaw(input)).toBe('会議\n\n前提の確認。言えばよかった')
  })

  it('何も書いていなければ空文字', () => {
    expect(composeRaw(base)).toBe('')
    expect(composeRaw({ ...base, events: '   ', reflectionQ: '問いだけ' })).toBe('')
  })
})

describe('composeBullets', () => {
  it('行と句点ごとに「・」で並べる（文言は変えない）', () => {
    expect(composeBullets({ ...base, events: '朝ジム。仕事は資料づくり\n夜はラーメン。' })).toBe(
      '・朝ジム\n・仕事は資料づくり\n・夜はラーメン'
    )
  })

  it('すでに付いている行頭の記号は付け直す', () => {
    expect(composeBullets({ ...base, events: '- 会議\n・散歩\n* 読書\n• 料理\n● 掃除\n○ 洗濯' })).toBe(
      '・会議\n・散歩\n・読書\n・料理\n・掃除\n・洗濯'
    )
  })

  it('複数の欄・ふりかえりの答えも続けて並べ、空行は飛ばす', () => {
    const input: ComposeInput = {
      ...base,
      events: '会議\n\n\n散歩',
      gratitude: '友達。',
      reflectionA: '前提の確認 — 言えばよかった',
    }
    expect(composeBullets(input)).toBe('・会議\n・散歩\n・友達\n・前提の確認\n・言えばよかった')
  })

  it('何も書いていなければ空文字', () => {
    expect(composeBullets(base)).toBe('')
  })
})

describe('inputKey', () => {
  it('気分・エネルギーだけの変更では変わらない', () => {
    const a = inputKey({ ...base, events: '会議' })
    const b = inputKey({ ...base, mood: 5, energy: 1, events: '会議' })
    expect(a).toBe(b)
  })

  it('前後の空白だけの違いでは変わらない', () => {
    expect(inputKey({ ...base, events: ' 会議\n' })).toBe(inputKey({ ...base, events: '会議' }))
  })

  it('メモ・ふりかえりの問いと答えが変われば変わる', () => {
    const k = inputKey({ ...base, events: '会議' })
    expect(inputKey({ ...base, events: '会議で疲れた' })).not.toBe(k)
    expect(inputKey({ ...base, events: '会議', reflectionQ: '問い' })).not.toBe(k)
    expect(inputKey({ ...base, events: '会議', reflectionA: '答え' })).not.toBe(k)
    // 同じ文字でも欄が違えば別の入力
    expect(inputKey({ ...base, gratitude: '会議' })).not.toBe(k)
  })

  it('欄が未定義でも落ちない', () => {
    const partial = { mood: null, energy: null } as unknown as ComposeInput
    expect(inputKey(partial)).toBe(JSON.stringify(['', '', '', '', '', '']))
  })
})

describe('DRAFT_MODES', () => {
  it('原文のまま・整える・箇条書きの3つ', () => {
    expect(DRAFT_MODES.map((m) => m.value)).toEqual(['raw', 'tidy', 'bullets'])
  })
})
