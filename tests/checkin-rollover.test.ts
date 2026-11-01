import { describe, expect, it } from 'vitest'
import {
  BACKFILL_DAYS,
  hasPendingCheckin,
  hasUnsavedWords,
  isValidPastDate,
  planDateRollover,
  type PendingCheckin,
} from '@/lib/checkin-rollover'
import { subtractDays } from '@/lib/jst'
import { TIME_ZONES, withTZ } from './helpers'

const TODAY = '2026-11-01'
const YESTERDAY = '2026-10-31'

/** チェックインの書きかけ（何も書いていない状態から、必要な所だけ変える） */
const pending = (over: Partial<PendingCheckin> = {}): PendingCheckin => ({
  mood: 3,
  checkinDate: YESTERDAY,
  targetDate: null,
  events: '',
  challenges: '',
  gratitude: '',
  freeform: '',
  editedDraft: '',
  ...over,
})

describe('isValidPastDate', () => {
  it('昨日から7日前までだけ', () => {
    expect(isValidPastDate(YESTERDAY, TODAY)).toBe(true)
    expect(isValidPastDate(subtractDays(TODAY, BACKFILL_DAYS), TODAY)).toBe(true)
    expect(isValidPastDate(subtractDays(TODAY, BACKFILL_DAYS + 1), TODAY)).toBe(false)
    expect(isValidPastDate(TODAY, TODAY)).toBe(false)
    expect(isValidPastDate('2026-11-02', TODAY)).toBe(false)
  })

  it('形式が違うものは受け付けない', () => {
    expect(isValidPastDate('2026-10-3', TODAY)).toBe(false)
    expect(isValidPastDate('yesterday', TODAY)).toBe(false)
    expect(isValidPastDate('', TODAY)).toBe(false)
  })
})

describe('hasUnsavedWords', () => {
  it('メモか清書のどれかに言葉があれば true（空白だけは数えない）', () => {
    expect(hasUnsavedWords(pending())).toBe(false)
    expect(hasUnsavedWords(pending({ events: '  \n' }))).toBe(false)
    expect(hasUnsavedWords(pending({ freeform: '眠い' }))).toBe(true)
    expect(hasUnsavedWords(pending({ editedDraft: '清書の本文' }))).toBe(true)
  })
})

describe('planDateRollover（日付をまたいだ書きかけ）', () => {
  it('同じ日のうちは、そのまま続ける', () => {
    expect(planDateRollover(pending({ checkinDate: TODAY, events: 'ジム' }), TODAY)).toEqual({ kind: 'keep' })
    expect(planDateRollover(pending({ checkinDate: null }), TODAY)).toEqual({ kind: 'keep' })
  })

  it('夜に書き始めて日付が変わっても、言葉があれば消さずに書き始めた日の記録として続ける', () => {
    expect(planDateRollover(pending({ events: '23時、会議の資料を直した' }), TODAY)).toEqual({
      kind: 'carry',
      targetDate: YESTERDAY,
    })
    // 清書まで進んでいた下書きも同じ
    expect(planDateRollover(pending({ editedDraft: '会議の資料を直した。' }), TODAY)).toEqual({
      kind: 'carry',
      targetDate: YESTERDAY,
    })
  })

  it('過去日付の記録の途中で日付が変わっても、対象日はそのまま（今日の記録にすり替えない）', () => {
    const p = pending({ targetDate: '2026-10-28', freeform: '書き忘れた日のこと' })
    expect(planDateRollover(p, TODAY)).toEqual({ kind: 'carry', targetDate: '2026-10-28' })
  })

  it('言葉が無い（気分だけ選んだ）書きかけは消して、今日の入力にする', () => {
    expect(planDateRollover(pending({ mood: 2 }), TODAY)).toEqual({ kind: 'reset' })
  })

  it('7日より前に書き始めたものは、過去日付として保存できないので消す', () => {
    const at = (days: number) => planDateRollover(pending({ checkinDate: subtractDays(TODAY, days), events: 'メモ' }), TODAY)
    expect(at(BACKFILL_DAYS).kind).toBe('carry')
    expect(at(BACKFILL_DAYS + 1)).toEqual({ kind: 'reset' })
  })

  it('端末のタイムゾーンに左右されない', () => {
    for (const tz of TIME_ZONES) {
      withTZ(tz, () => {
        expect(planDateRollover(pending({ events: 'メモ' }), TODAY), tz).toEqual({ kind: 'carry', targetDate: YESTERDAY })
        expect(planDateRollover(pending({ checkinDate: subtractDays(TODAY, 8), events: 'メモ' }), TODAY), tz).toEqual({
          kind: 'reset',
        })
      })
    }
  })
})

describe('hasPendingCheckin（ホームの「書きかけ」）', () => {
  it('今日書き始めて気分を選んであれば書きかけ', () => {
    expect(hasPendingCheckin(pending({ checkinDate: TODAY }), TODAY)).toBe(true)
    expect(hasPendingCheckin(pending({ checkinDate: TODAY, mood: null }), TODAY)).toBe(false)
  })

  it('日付をまたいだ言葉のある書きかけも書きかけ（開けば続きから書ける）', () => {
    expect(hasPendingCheckin(pending({ events: 'メモ' }), TODAY)).toBe(true)
    // 言葉の無い・古すぎる書きかけは、開いたときに消えるので出さない
    expect(hasPendingCheckin(pending(), TODAY)).toBe(false)
    expect(hasPendingCheckin(pending({ checkinDate: subtractDays(TODAY, 8), events: 'メモ' }), TODAY)).toBe(false)
  })

  it('今日始めた過去日付の書きかけは、言葉があるときだけ', () => {
    expect(hasPendingCheckin(pending({ checkinDate: TODAY, targetDate: YESTERDAY }), TODAY)).toBe(false)
    expect(hasPendingCheckin(pending({ checkinDate: TODAY, targetDate: YESTERDAY, events: 'メモ' }), TODAY)).toBe(true)
  })

  it('保存されている値が欠けていても落ちない（古い端末の保存形式）', () => {
    expect(hasPendingCheckin({ mood: 3, checkinDate: TODAY }, TODAY)).toBe(true)
    expect(hasPendingCheckin({}, TODAY)).toBe(false)
  })
})
