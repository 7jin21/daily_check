import { describe, expect, it } from 'vitest'
import { formatEntriesForPrompt, type PromptEntry, type PromptLimits } from '@/lib/prompt-context'

const LIMITS: PromptLimits = { events: 100, challenges: 100, gratitude: 100, freeform: 100 }

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
  it('1行1日で、欄を「 / 」でつなぐ', () => {
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
      '[2026-10-10] 気分:4/5 エネルギー:3/5 / 出来事: 会議 / 困ったこと: 眠い / 感謝: 友達 / メモ・ふりかえり: メモ\n\n【ふりかえり】Q\n→ A / 感情: 満足'
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
    expect(formatEntriesForPrompt([e], { events: 3, challenges: 4, gratitude: 5, freeform: 6 })).toBe(
      '[2026-10-10] 気分:4/5 エネルギー:3/5 / 出来事: あいう / 困ったこと: さしすせ / 感謝: なにぬねの / メモ・ふりかえり: まみむめもや'
    )
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
