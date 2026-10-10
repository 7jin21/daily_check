import { describe, expect, it } from 'vitest'
import {
  buildDraftUserPrompt,
  countInputChars,
  DRAFT_GENERATION,
  DRAFT_SYSTEM_PROMPT,
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

  it('生成パラメータ', () => {
    expect(DRAFT_GENERATION).toEqual({ max_tokens: 1536, temperature: 0.3, reasoning_effort: 'low' })
  })
})
