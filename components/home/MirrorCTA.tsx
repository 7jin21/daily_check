'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { STORAGE_KEYS } from '@/lib/constants'

// 水面の上の呼びかけ。状態は3つ:
// 記録済み → 今日の一文と「日記を読む」／書きかけ（localStorage に今日の入力途中）→「続きを書く」／未記録 →「今日を記録する」
// （書きかけの判定は localStorage が要るのでクライアントで行う）

interface Props {
  today: string
  greeting: string
  todaySummary: string | null
  hasTodayEntry: boolean
  moodOnly?: boolean // 今日の記録が気分だけ（言葉はまだ）
  missedYesterday: string | null // 昨日の日付（書き忘れのときだけ）
}

function Arrow() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8h9.5M8.5 3.5 13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function MirrorCTA({ today, greeting, todaySummary, hasTodayEntry, moodOnly = false, missedYesterday }: Props) {
  const [hasDraft, setHasDraft] = useState(false)

  useEffect(() => {
    if (hasTodayEntry) return
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CHECKIN_DRAFT)
      if (!raw) return
      const s = (JSON.parse(raw) as {
        state?: { mood?: number | null; checkinDate?: string | null; targetDate?: string | null }
      }).state
      // 今日開始した入力で、気分だけでも選んであれば「書きかけ」（過去日付の入力は除く）
      if (s && s.mood != null && s.checkinDate === today && !s.targetDate) setHasDraft(true)
    } catch {
      // localStorage が読めない環境では通常表示
    }
  }, [today, hasTodayEntry])

  const yesterdayLink = missedYesterday ? (
    <Link href={`/checkin?date=${missedYesterday}`} className="im-textlink">
      昨日の分も書く
    </Link>
  ) : null

  if (hasTodayEntry && moodOnly) {
    return (
      <>
        <p className="im-cta-eyebrow">今日の記録</p>
        <p className="im-cta-title">
          気分だけ、
          <br />
          残しました。
        </p>
        <div className="im-cta-row">
          <Link href={`/entries/${today}?write=1`} className="im-pill">
            言葉を書き足す
            <span className="im-pill-arrow"><Arrow /></span>
          </Link>
          {yesterdayLink}
        </div>
      </>
    )
  }

  if (hasTodayEntry) {
    return (
      <>
        <p className="im-cta-eyebrow">今日の記録</p>
        <p className="im-cta-quote">{todaySummary ? `「${todaySummary}」` : '今日の記録は、ちゃんと残っています。'}</p>
        <div className="im-cta-row">
          <Link href={`/entries/${today}`} className="im-pill">
            日記を読む
            <span className="im-pill-arrow"><Arrow /></span>
          </Link>
          {yesterdayLink}
        </div>
      </>
    )
  }

  return (
    <>
      <p className="im-cta-eyebrow">{hasDraft ? '書きかけ' : greeting}</p>
      <p className="im-cta-title">
        {hasDraft ? (
          <>書きかけの記録が<br />残っています。</>
        ) : (
          <>今日は、<br />どんな一日でしたか。</>
        )}
      </p>
      <div className="im-cta-row">
        <Link href="/checkin" className="im-pill">
          {hasDraft ? '続きを書く' : '今日を記録する'}
          <span className="im-pill-arrow"><Arrow /></span>
        </Link>
        {yesterdayLink}
      </div>
    </>
  )
}
