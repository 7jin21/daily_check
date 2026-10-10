import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateOfflineDraft } from '@/lib/offline-draft'
import type { CheckinInput } from '@/stores/checkin'
import { TIME_ZONES, withTZ } from './helpers'

const full: CheckinInput = { mood: 4, energy: 3, events: ' 会議 ', challenges: '眠い', gratitude: '友達', freeform: 'メモ' }
const empty: CheckinInput = { mood: null, energy: null, events: '', challenges: '', gratitude: '', freeform: '' }

describe('generateOfflineDraft', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('指定した日付の日記として、書いた欄を見出しつきで並べる', () => {
    const r = generateOfflineDraft(full, '2026-10-09')
    expect(r.draft).toBe(
      [
        '2026年10月9日金曜日の記録',
        '',
        '今日の気分は良い（🙂）、エネルギーは普通でした。',
        '',
        '【今日の出来事】',
        '会議',
        '',
        '【課題・困ったこと】',
        '眠い',
        '',
        '【感謝できること】',
        '友達',
        '',
        '【メモ】',
        'メモ',
      ].join('\n')
    )
  })

  it('タグ・サマリー・主な感情を気分と欄から作る', () => {
    const r = generateOfflineDraft(full, '2026-10-09')
    expect(r.tags).toEqual(['良い', 'エネルギー:普通', '課題あり', '感謝'])
    expect(r.summary).toBe('気分良い・エネルギー普通')
    expect(r.dominantEmotion).toBe('満足')
    expect(r.fromAI).toBeUndefined()
  })

  it('対象日の表示はプロセスのタイムゾーンに左右されない（サーバーは UTC で動く）', () => {
    for (const tz of TIME_ZONES) {
      withTZ(tz, () => {
        expect(generateOfflineDraft(full, '2026-01-01').draft.split('\n')[0]).toBe('2026年1月1日木曜日の記録')
      })
    }
  })

  it('日付を省く・形が違うときは日本時間の今日', () => {
    vi.useFakeTimers({ now: new Date('2026-10-09T15:30:00Z') }) // JST 2026-10-10 00:30
    withTZ('UTC', () => {
      expect(generateOfflineDraft(full).draft.split('\n')[0]).toBe('2026年10月10日土曜日の記録')
      expect(generateOfflineDraft(full, null).draft.split('\n')[0]).toBe('2026年10月10日土曜日の記録')
      expect(generateOfflineDraft(full, '2026/10/01').draft.split('\n')[0]).toBe('2026年10月10日土曜日の記録')
    })
  })

  it('気分が未入力で欄も空なら、日付の行だけ', () => {
    const r = generateOfflineDraft(empty, '2026-10-09')
    expect(r.draft).toBe('2026年10月9日金曜日の記録\n')
    expect(r.tags).toEqual([])
    expect(r.summary).toBe('')
    expect(r.dominantEmotion).toBe('平静')
  })

  it.each([
    [1, '落ち込み'],
    [2, '不安'],
    [3, '平静'],
    [4, '満足'],
    [5, '喜び'],
  ])('気分 %i の主な感情は %s', (mood, emotion) => {
    expect(generateOfflineDraft({ ...empty, mood, energy: 3 }, '2026-10-09').dominantEmotion).toBe(emotion)
  })
})
