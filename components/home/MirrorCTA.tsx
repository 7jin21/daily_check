'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { STORAGE_KEYS } from '@/lib/constants'
import { hasPendingCheckin, type PendingCheckin } from '@/lib/checkin-rollover'
import Pill from './Pill'

// 水面の上の呼びかけ。状態は3つ:
// 記録済み → 今日の一文と「日記を読む」／書きかけ（localStorage に入力途中。日付をまたいだ言葉のある書きかけも）→「続きを書く」／未記録 →「今日を記録する」
// （書きかけの判定は localStorage が要るのでクライアントで行う）

interface Props {
  today: string
  greeting: string
  /** 今日の一文（「」つき。文節で折り返すよう、サーバーで組んだもの）。無ければ null */
  todayQuote: ReactNode
  hasTodayEntry: boolean
  moodOnly?: boolean // 今日の記録が気分だけ（言葉はまだ）
  missedYesterday: string | null // 昨日の日付（書き忘れのときだけ）
}

export default function MirrorCTA({ today, greeting, todayQuote, hasTodayEntry, moodOnly = false, missedYesterday }: Props) {
  const [hasDraft, setHasDraft] = useState(false)

  useEffect(() => {
    if (hasTodayEntry) return
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CHECKIN_DRAFT)
      if (!raw) return
      const s = (JSON.parse(raw) as { state?: Partial<PendingCheckin> }).state
      // 今日開始した入力で気分を選んである、または日付をまたいでも消さない「言葉のある書きかけ」が残っている
      // （後者はチェックインを開くと、書き始めた日の記録として続きから書ける）
      if (s && hasPendingCheckin(s, today)) setHasDraft(true)
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
          <Pill href={`/entries/${today}?write=1`}>言葉を書き足す</Pill>
          {yesterdayLink}
        </div>
      </>
    )
  }

  if (hasTodayEntry) {
    return (
      <>
        <p className="im-cta-eyebrow">今日の記録</p>
        <p className="im-cta-quote">{todayQuote ?? '今日の記録は、ちゃんと残っています。'}</p>
        <div className="im-cta-row">
          <Pill href={`/entries/${today}`}>日記を読む</Pill>
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
        <Pill href="/checkin">{hasDraft ? '続きを書く' : '今日を記録する'}</Pill>
        {yesterdayLink}
      </div>
    </>
  )
}
