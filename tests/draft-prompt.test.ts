import { describe, expect, it } from 'vitest'
import {
  buildDraftUserPrompt,
  countInputChars,
  DRAFT_CUT_MARK,
  DRAFT_GENERATION,
  DRAFT_SYSTEM_PROMPT,
  draftMaxTokens,
  rewriteMaxTokens,
  splitCutMark,
  type DraftPromptInput,
} from '@/lib/draft-prompt'
import { TIME_ZONES, withTZ } from './helpers'

const base: DraftPromptInput = { mood: 4, energy: 3, events: '', challenges: '', gratitude: '', freeform: '' }

/** 長さの目安の一文から「◯文字以内」の数字を取り出す */
function budgetOf(prompt: string): number {
  const m = prompt.match(/おおむね(\d+)文字以内/)
  if (!m) throw new Error(`長さの目安が無い: ${prompt}`)
  return Number(m[1])
}

describe('countInputChars', () => {
  it('メモの各欄とふりかえりの答えの文字数を、前後の空白を除いて足す', () => {
    expect(countInputChars({ ...base, events: ' 会議 ', challenges: '眠い', gratitude: '友達\n', freeform: 'メモ', reflectionA: '答え' })).toBe(10)
  })

  it('ふりかえりの問いは数えない', () => {
    expect(countInputChars({ ...base, reflectionQ: 'とても長い問いの文章' })).toBe(0)
  })

  it('欄が文字列でなくても落ちない', () => {
    expect(countInputChars({ ...base, events: null as unknown as string })).toBe(0)
  })
})

describe('buildDraftUserPrompt', () => {
  it('気分・エネルギー・メモ・長さの目安を段落で並べる', () => {
    expect(buildDraftUserPrompt({ ...base, events: '会議 疲れた' }, null)).toBe(
      [
        '気分: 4/5（良い）',
        'エネルギー: 3/5（普通）',
        '【本人のメモ: 今日あったこと】\n会議 疲れた',
        '本人のメモは合計約6文字です。清書後もおおむね40文字以内に収めてください。',
      ].join('\n\n')
    )
  })

  it('すべての欄をこの順で渡す', () => {
    const p = buildDraftUserPrompt({ ...base, events: ' A ', challenges: 'B', gratitude: 'C', freeform: 'D' }, null)
    expect(p).toContain(
      '【本人のメモ: 今日あったこと】\nA\n\n【本人のメモ: 困ったこと】\nB\n\n【本人のメモ: 感謝・良かったこと】\nC\n\n【本人のメモ: 自由メモ】\nD'
    )
  })

  it('過去の日付なら対象日を明示する（プロセスの TZ に左右されない）', () => {
    for (const tz of TIME_ZONES) {
      withTZ(tz, () => {
        const p = buildDraftUserPrompt({ ...base, events: '会議' }, '2026-10-09')
        expect(p.startsWith('この日記の対象日: 10月9日金曜日（あとから振り返って書いている）\n\n気分: 4/5')).toBe(true)
      })
    }
  })

  it('今日の日記（entryDate なし）には対象日を書かない', () => {
    expect(buildDraftUserPrompt({ ...base, events: '会議' }, null)).not.toContain('対象日')
  })

  it('メモが無ければ、出来事を創作しないよう1文だけ頼む', () => {
    const p = buildDraftUserPrompt(base, null)
    expect(p).not.toContain('【本人のメモ')
    expect(p).not.toContain('文字以内')
    expect(p).toContain('本人のメモはありません。')
    expect(p).toContain('出来事は創作しないこと。')
  })

  it('空白だけの欄はメモとして扱わない', () => {
    const p = buildDraftUserPrompt({ ...base, events: '  \n', freeform: ' ' }, null)
    expect(p).not.toContain('【本人のメモ')
    expect(p).toContain('本人のメモはありません。')
  })

  it('長さの目安は max(40, round(文字数 × 1.3))', () => {
    const at = (n: number) => budgetOf(buildDraftUserPrompt({ ...base, events: 'あ'.repeat(n) }, null))
    expect(at(1)).toBe(40)
    expect(at(30)).toBe(40) // 39
    expect(at(31)).toBe(40) // 40.3
    expect(at(32)).toBe(42) // 41.6
    expect(at(35)).toBe(46) // 45.5 → 46
    expect(at(100)).toBe(130)
    expect(at(500)).toBe(650)
  })

  it('文字数の合計を伝える（ふりかえりの答えも含む）', () => {
    const p = buildDraftUserPrompt({ ...base, events: '会議', reflectionQ: '問い', reflectionA: '前提の確認' }, null)
    expect(p).toContain('本人のメモは合計約7文字です。')
  })

  it('気分・エネルギーが未入力でも落ちない', () => {
    const p = buildDraftUserPrompt({ ...base, mood: null, energy: null, events: '会議' }, null)
    expect(p).toContain('気分: null/5（-）')
    expect(p).toContain('エネルギー: null/5（-）')
  })

  describe('ふりかえり', () => {
    it('問いと答えの両方があるときだけ渡す', () => {
      const p = buildDraftUserPrompt({ ...base, events: '会議', reflectionQ: ' 一番引っかかったのは？ ', reflectionA: ' 前提の確認 ' }, null)
      expect(p).toContain(
        '【ふりかえり】\n問い: 一番引っかかったのは？\n本人の答え: 前提の確認\n（問いやラベルは書かず、答えの言葉だけを使う）'
      )
    })

    it('片方だけなら渡さない', () => {
      expect(buildDraftUserPrompt({ ...base, events: '会議', reflectionQ: '問い' }, null)).not.toContain('【ふりかえり】')
      expect(buildDraftUserPrompt({ ...base, events: '会議', reflectionA: '答え' }, null)).not.toContain('【ふりかえり】')
      expect(buildDraftUserPrompt({ ...base, events: '会議', reflectionQ: '問い', reflectionA: '  ' }, null)).not.toContain(
        '【ふりかえり】'
      )
    })

    it('問いと答えはそれぞれ300文字までに切る', () => {
      const p = buildDraftUserPrompt({ ...base, reflectionQ: 'Q'.repeat(400), reflectionA: 'A'.repeat(400) }, null)
      expect(p).toContain(`問い: ${'Q'.repeat(300)}\n`)
      expect(p).toContain(`本人の答え: ${'A'.repeat(300)}\n`)
      expect(p).not.toContain('Q'.repeat(301))
      expect(p).not.toContain('A'.repeat(301))
    })
  })
})

describe('清書の方針', () => {
  it('AI は清書係: 言い換え・水増し・締めの一文を禁じている', () => {
    expect(DRAFT_SYSTEM_PROMPT).toContain('清書する係')
    expect(DRAFT_SYSTEM_PROMPT).toContain('別の言葉に言い換えない')
    expect(DRAFT_SYSTEM_PROMPT).toContain('水増ししない')
    expect(DRAFT_SYSTEM_PROMPT).toContain('明日も頑張ろう')
  })

  it('生成パラメータ（出力の上限は入力の長さで決める）', () => {
    expect(DRAFT_GENERATION).toEqual({ temperature: 0.3, reasoning_effort: 'low' })
  })
})

describe('draftMaxTokens（清書の出力の上限）', () => {
  // 画面で書ける最大: 4欄 × 500字＋内省の一言
  const longest: DraftPromptInput = {
    ...base,
    events: 'あ'.repeat(500),
    challenges: 'い'.repeat(500),
    gratitude: 'う'.repeat(500),
    freeform: 'え'.repeat(500),
    reflectionQ: '何を大事にしていた？',
    reflectionA: `丁寧さ — ${'お'.repeat(200)}`,
  }

  it('短い入力では、これまでどおり 1536', () => {
    expect(draftMaxTokens({ ...base, events: '朝ジム' })).toBe(1536)
    expect(draftMaxTokens(base)).toBe(1536)
  })

  it('長い入力ほど広げ、指示している長さ（入力の 1.3 倍）を 1 文字 1 トークンで見積もっても収まる', () => {
    // 日本語の日記文は gpt-oss で 1 トークン ≒ 1.2 文字なので、1 文字 1 トークンの見積もりなら余裕がある
    const chars = countInputChars(longest)
    expect(chars).toBeGreaterThan(2000)
    const limit = draftMaxTokens(longest)
    expect(limit).toBeGreaterThanOrEqual(Math.ceil(chars * 1.3))
    expect(limit).toBeLessThanOrEqual(4096)
    // 以前の 1536 固定では、1,500 字を超えるあたりのメモの清書が途中で切れていた
    expect(draftMaxTokens({ ...base, events: 'あ'.repeat(1500) })).toBeGreaterThan(1536)
  })

  it('APIが受け付ける4欄×1000字と内省回答にも、推論分の余裕を確保する', () => {
    const input = {
      ...base, events: 'あ'.repeat(1000), challenges: 'い'.repeat(1000),
      gratitude: 'う'.repeat(1000), freeform: 'え'.repeat(1000), reflectionA: 'お'.repeat(300),
    }
    expect(draftMaxTokens(input)).toBeGreaterThanOrEqual(Math.ceil(countInputChars(input) * 1.3) + 1024)
    expect(draftMaxTokens(input)).toBeLessThanOrEqual(8192)
  })
})

describe('rewriteMaxTokens（書き直しの出力の上限）', () => {
  it('受け付ける最長（2000字）でも、長くなる書き直しが収まるよう広げる（上限は 4096）', () => {
    expect(rewriteMaxTokens(100)).toBe(1024)
    expect(rewriteMaxTokens(1000)).toBeGreaterThanOrEqual(2000)
    expect(rewriteMaxTokens(2000)).toBe(4096)
  })
})

describe('splitCutMark（途中で切れた清書の印）', () => {
  it('印が無ければそのまま・印があれば取り除いて cut にする', () => {
    expect(splitCutMark('今日は会議だった。')).toEqual({ text: '今日は会議だった。', cut: false })
    expect(splitCutMark(`今日は会議だっ${DRAFT_CUT_MARK}`)).toEqual({ text: '今日は会議だっ', cut: true })
  })

  it('印は本文に現れない制御文字で、取り除けば何も残らない（trim では消えないので必ず splitCutMark を通す）', () => {
    expect(DRAFT_CUT_MARK).toMatch(/^[\u0000-\u0008\u000e-\u001f]$/)
    expect(DRAFT_SYSTEM_PROMPT.includes(DRAFT_CUT_MARK)).toBe(false)
    expect(DRAFT_CUT_MARK.trim()).toBe(DRAFT_CUT_MARK)
    expect(splitCutMark(DRAFT_CUT_MARK)).toEqual({ text: '', cut: true })
  })
})
