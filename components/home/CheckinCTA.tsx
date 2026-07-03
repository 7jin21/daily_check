'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { STORAGE_KEYS } from '@/lib/constants'

// ホームのチェックイン CTA。
// 未記録時、localStorage に今日の入力途中データがあれば「続きから再開」に切り替える
// （サーバーコンポーネントからは localStorage が読めないためクライアントで判定）

interface Props {
  today: string // YYYY-MM-DD (JST)
  todayEntry: { summary: string | null } | null
}

export default function CheckinCTA({ today, todayEntry }: Props) {
  const [hasDraftInProgress, setHasDraftInProgress] = useState(false)

  useEffect(() => {
    if (todayEntry) return
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CHECKIN_DRAFT)
      if (!raw) return
      const parsed = JSON.parse(raw) as {
        state?: { mood?: number | null; checkinDate?: string | null; targetDate?: string | null }
      }
      const s = parsed.state
      // 「今日開始した入力で、気分だけでも選んである」なら途中とみなす（過去日付の入力は除く）
      if (s && s.mood != null && s.checkinDate === today && !s.targetDate) {
        setHasDraftInProgress(true)
      }
    } catch {
      // localStorage が読めない環境では通常表示
    }
  }, [today, todayEntry])

  if (todayEntry) {
    return (
      <Link
        href={`/entries/${today}`}
        className="block w-full p-7 rounded-[3px] bg-[#e7dcc7] border border-[#ddd0b8] active:scale-[0.99] transition-transform dark:bg-[var(--surface)] dark:border-[var(--border)]"
      >
        <div className="eyebrow mb-3" style={{ letterSpacing: '0.3em' }}>Today&apos;s check-in</div>
        <p className="font-bold text-xl text-[var(--foreground)] tracking-tight">今日の記録、完了しました</p>
        <p className="text-sm text-[var(--muted)] mt-2 leading-relaxed">
          {todayEntry.summary ?? '記録済み'}
        </p>
      </Link>
    )
  }

  return (
    <Link
      href="/checkin"
      className="block w-full p-7 rounded-[3px] bg-[#2a2622] active:scale-[0.99] transition-transform"
    >
      <div className="eyebrow mb-3" style={{ color: 'var(--accent)', letterSpacing: '0.3em' }}>
        Today&apos;s check-in
      </div>
      <p className="font-bold text-xl text-[#f4efe6] tracking-tight">
        {hasDraftInProgress ? '書きかけの記録があります' : 'まだ今日の記録がありません'}
      </p>
      <p className="text-sm text-[#f4efe6]/55 mt-2 leading-relaxed">
        {hasDraftInProgress
          ? '入力は自動保存されています。続きから再開できます。'
          : '今日はどんな一日でしたか。ひと言だけでも残しておきましょう。'}
      </p>
      <span className="inline-block mt-5 bg-[var(--accent)] text-[#2a2622] text-sm font-bold px-7 py-3 rounded-[2px] tracking-wide">
        {hasDraftInProgress ? '続きから再開する →' : '今日を記録する →'}
      </span>
    </Link>
  )
}
