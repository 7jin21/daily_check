import { describe, expect, it } from 'vitest'
import { formatEntriesForPrompt, ownBodyText, type PromptEntry, type PromptLimits } from '@/lib/prompt-context'
import { appendLaterNote, withReflection } from '@/lib/freeform'

const LIMITS: PromptLimits = { events: 100, challenges: 100, gratitude: 100, freeform: 100, reflection: 100, body: 100 }

const blank: PromptEntry = {
  entry_date: '2026-10-10',
  mood: 4,
  energy: 3,
  events: null,
  challenges: null,
  gratitude: null,
  freeform: null,
  dominant_emotion: null,
}

describe('formatEntriesForPrompt', () => {
  it('1行1日で、欄を「 / 」でつなぐ（ふりかえりはメモとは別に1件ずつ）', () => {
    const e: PromptEntry = {
      entry_date: '2026-10-10',
      mood: 4,
      energy: 3,
      events: '会議',
      challenges: '眠い',
      gratitude: '友達',
      freeform: 'メモ\n\n【ふりかえり】Q\n→ A',
      dominant_emotion: '満足',
    }
    expect(formatEntriesForPrompt([e], LIMITS)).toBe(
      '[2026-10-10] 気分:4/5 エネルギー:3/5 / 出来事: 会議 / 困ったこと: 眠い / 感謝: 友達 / メモ: メモ / 【ふりかえり】Q → A / 感情: 満足'
    )
  })

  it('空・空白だけの欄は書かない', () => {
    const e: PromptEntry = { ...blank, events: '会議', challenges: '  ', gratitude: '', freeform: null, dominant_emotion: ' ' }
    expect(formatEntriesForPrompt([e], LIMITS)).toBe('[2026-10-10] 気分:4/5 エネルギー:3/5 / 出来事: 会議')
    expect(formatEntriesForPrompt([blank], LIMITS)).toBe('[2026-10-10] 気分:4/5 エネルギー:3/5')
  })

  it('欄ごとの上限で切る', () => {
    const e: PromptEntry = {
      ...blank,
      events: 'あいうえおかきくけこ',
      challenges: 'さしすせそたちつてと',
      gratitude: 'なにぬねのはひふへほ',
      freeform: 'まみむめもやゆよらり',
    }
    expect(formatEntriesForPrompt([e], { ...LIMITS, events: 3, challenges: 4, gratitude: 5, freeform: 6 })).toBe(
      '[2026-10-10] 気分:4/5 エネルギー:3/5 / 出来事: あいう / 困ったこと: さしすせ / 感謝: なにぬねの / メモ: まみむめもや'
    )
  })

  it('自由メモが長くても、うしろに保存されたふりかえりは必ず渡す（以前はメモごと先頭から切れて届かなかった）', () => {
    const memo = 'あ'.repeat(170)
    const e: PromptEntry = { ...blank, freeform: withReflection(memo, '何を大事にしていた？', '丁寧に扱われること') }
    const out = formatEntriesForPrompt([e], { ...LIMITS, freeform: 160, reflection: 120 })
    expect(out).toContain(`メモ: ${'あ'.repeat(160)} /`)
    expect(out).toContain('【ふりかえり】何を大事にしていた？ → 丁寧に扱われること')
  })

  it('ふりかえりの答え・あとからの一言は、それぞれの上限で切る', () => {
    const ff = appendLaterNote(withReflection('', 'Q', 'かきくけこ'), '2026-10-20', 'さしすせそ')
    expect(formatEntriesForPrompt([{ ...blank, freeform: ff }], { ...LIMITS, reflection: 3 })).toBe(
      '[2026-10-10] 気分:4/5 エネルギー:3/5 / 【ふりかえり】Q → かきく / 【あとから 2026-10-20】さしす'
    )
  })

  it('以前の版で保存された「どれも近くない」は答えに数えない（一言つきなら一言だけ）', () => {
    const ff = [withReflection('', 'Q1', 'どれも近くない'), '【ふりかえり】Q2\n→ どれも近くない — 時間が足りなかった'].join('\n\n')
    expect(formatEntriesForPrompt([{ ...blank, freeform: ff }], LIMITS)).toBe(
      '[2026-10-10] 気分:4/5 エネルギー:3/5 / 【ふりかえり】Q2 → 時間が足りなかった'
    )
  })

  it('絵文字を途中で割らない', () => {
    const out = formatEntriesForPrompt([{ ...blank, events: '😊😊😊' }], { ...LIMITS, events: 2 })
    expect(out).toBe('[2026-10-10] 気分:4/5 エネルギー:3/5 / 出来事: 😊😊')
  })

  it('複数の日は改行でつなぎ、渡された順のまま', () => {
    const a: PromptEntry = { ...blank, entry_date: '2026-10-09', mood: 2, energy: 1, events: 'A' }
    const b: PromptEntry = { ...blank, entry_date: '2026-10-10', mood: 5, energy: 5, gratitude: 'B' }
    expect(formatEntriesForPrompt([a, b], LIMITS)).toBe(
      '[2026-10-09] 気分:2/5 エネルギー:1/5 / 出来事: A\n[2026-10-10] 気分:5/5 エネルギー:5/5 / 感謝: B'
    )
  })

  it('記録が無ければ空文字', () => {
    expect(formatEntriesForPrompt([], LIMITS)).toBe('')
  })
})

describe('本文にしか言葉が無い日（気分だけ → あとから日記の画面で書き足した日）', () => {
  const written: PromptEntry = { ...blank, edited_draft: '帰り道、金木犀の香りがした。', ai_draft: null }

  it('その本文を「日記」として AI に渡す（以前は言葉の無い日に見えていた）', () => {
    expect(ownBodyText(written)).toBe('帰り道、金木犀の香りがした。')
    expect(formatEntriesForPrompt([written], LIMITS)).toBe('[2026-10-10] 気分:4/5 エネルギー:3/5 / 日記: 帰り道、金木犀の香りがした。')
    expect(formatEntriesForPrompt([written], { ...LIMITS, body: 4 })).toBe('[2026-10-10] 気分:4/5 エネルギー:3/5 / 日記: 帰り道、')
  })

  it('メモ欄がある日の編集本文は、本人の原文と分けて補助材料にする', () => {
    const e: PromptEntry = { ...written, events: '会議', edited_draft: '会議があった。とても実りある一日だった。' }
    expect(ownBodyText(e)).toBe('')
    expect(formatEntriesForPrompt([e], LIMITS)).not.toContain('日記:')
    expect(formatEntriesForPrompt([e], LIMITS)).toContain('編集後の本文（AI清書を含む場合あり）: 会議があった。とても実りある一日だった。')
  })

  it('AI の清書が関わった日（ai_draft がある日）は、メモ欄が空でも本文を渡さない', () => {
    expect(ownBodyText({ ...written, ai_draft: '気分は良く、体力はふつうの一日だった。' })).toBe('')
  })

  it('ふりかえり・あとからの一言しかない日も、本文は本人の言葉として渡す（メモの部分が空なら）', () => {
    const e: PromptEntry = { ...written, freeform: appendLaterNote('', '2026-10-20', '今思うと良い日') }
    expect(ownBodyText(e)).toBe('帰り道、金木犀の香りがした。')
    expect(formatEntriesForPrompt([e], LIMITS)).toBe(
      '[2026-10-10] 気分:4/5 エネルギー:3/5 / 【あとから 2026-10-20】今思うと良い日 / 日記: 帰り道、金木犀の香りがした。'
    )
  })

  it('本文も無ければ何も足さない', () => {
    expect(ownBodyText(blank)).toBe('')
    expect(ownBodyText({ ...blank, edited_draft: '  \n' })).toBe('')
  })

  it('編集していないAI清書を分析の追加材料にしない', () => {
    const text = '会議の経験から多くを学び、心が満たされた。'
    const out = formatEntriesForPrompt([{ ...blank, events: '会議', ai_draft: text, edited_draft: text }], LIMITS)
    expect(out).not.toContain(text)
    expect(out).not.toContain('編集後の本文')
  })

  it('AI清書後の訂正は原文と区別して渡す', () => {
    const e: PromptEntry = { ...blank, events: '会議の予定', ai_draft: '会議に出席した。', edited_draft: '訂正：会議は中止だった。' }
    const out = formatEntriesForPrompt([e], LIMITS)
    expect(out).toContain('出来事: 会議の予定')
    expect(out).toContain('編集後の本文（AI清書を含む場合あり）: 訂正：会議は中止だった。')
    expect(ownBodyText(e)).toBe('')
  })

  it('長い本文末尾の追記も、絵文字を割らずに補助材料へ渡す', () => {
    const e: PromptEntry = { ...blank, events: '朝のメモ', ai_draft: '朝の本文', edited_draft: `朝の出来事${'😊'.repeat(100)}夜に追記した言葉` }
    const out = formatEntriesForPrompt([e], { ...LIMITS, body: 30 })
    const body = out.split('編集後の本文（AI清書を含む場合あり）: ')[1]
    expect(Array.from(body)).toHaveLength(30)
    expect(body).toContain(' … ')
    expect(body).toContain('夜に追記した言葉')
    expect(body).not.toMatch(/\uFFFD/)
  })
})
