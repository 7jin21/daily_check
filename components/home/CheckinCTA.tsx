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
        className="cta-paper relative block w-full p-7 rounded-[26px] border border-[var(--border)] shadow-[0_14px_38px_rgba(72,70,52,0.12)] overflow-hidden active:scale-[0.99] transition-transform"
      >
        <NotebookArt />
        <div className="relative">
          <CtaEyebrow label="Today's check-in" />
          <p className="font-bold text-[22px] text-[var(--foreground)] tracking-wide leading-snug">
            今日の記録、<br className="hidden" />完了しました
          </p>
          <p className="text-sm text-[var(--muted)] mt-3 leading-relaxed max-w-[16em]">
            {todayEntry.summary ?? '記録済み'}
          </p>
          <span className="inline-flex items-center gap-2 mt-6 px-7 py-3 rounded-full border border-[var(--primary)]/50 text-[var(--primary)] text-sm font-bold tracking-wide">
            日記を読む →
          </span>
        </div>
      </Link>
    )
  }

  return (
    <Link
      href="/checkin"
      className="cta-paper relative block w-full p-7 rounded-[26px] border border-[var(--border)] shadow-[0_14px_38px_rgba(72,70,52,0.12)] overflow-hidden active:scale-[0.99] transition-transform"
    >
      <NotebookArt />
      <div className="relative">
        <CtaEyebrow label="Today's check-in" />
        <p className="font-bold text-[22px] text-[var(--foreground)] tracking-wide leading-snug">
          {hasDraftInProgress ? '書きかけの記録があります' : 'まだ今日の記録がありません'}
        </p>
        <p className="text-sm text-[var(--muted)] mt-3 leading-relaxed max-w-[15em]">
          {hasDraftInProgress
            ? '入力は自動保存されています。続きから再開できます。'
            : '今日はどんな一日でしたか。ひと言だけでも残しておきましょう。'}
        </p>
        <span className="btn-pill inline-flex items-center gap-2 mt-6 px-8 py-3.5 text-[15px] font-bold tracking-wide">
          {hasDraftInProgress ? '続きから再開する →' : '今日を記録する →'}
        </span>
      </div>
    </Link>
  )
}

/** 緑の小見出し＋短いアンダーライン */
function CtaEyebrow({ label }: { label: string }) {
  return (
    <div className="mb-4">
      <span className="eyebrow" style={{ letterSpacing: '0.24em' }}>{label}</span>
      <span className="block w-10 h-[2px] bg-[var(--primary)]/60 mt-1.5" />
    </div>
  )
}

/** 右側の装飾（開いたノートとペンの線画。写真の代わりの上品なイラスト） */
function NotebookArt() {
  return (
    <svg
      viewBox="0 0 160 160"
      fill="none"
      aria-hidden="true"
      className="absolute -right-4 -bottom-6 w-44 h-44 opacity-[0.55] pointer-events-none"
    >
      {/* ノート */}
      <g transform="rotate(-12 80 100)">
        <rect x="30" y="60" width="100" height="70" rx="7" fill="#e7e2cf" stroke="#b9b294" strokeWidth="1.5" />
        <line x1="80" y1="60" x2="80" y2="130" stroke="#b9b294" strokeWidth="1.2" />
        {[74, 84, 94, 104, 114].map((y) => (
          <g key={y} stroke="#c3bd9f" strokeWidth="1">
            <line x1="38" y1={y} x2="72" y2={y} />
            <line x1="88" y1={y} x2="122" y2={y} />
          </g>
        ))}
        {/* しおり */}
        <path d="M120 60 v22 l-5 -6 l-5 6 v-22 z" fill="#6b8756" opacity="0.85" />
      </g>
      {/* ペン */}
      <g transform="rotate(32 110 78)">
        <rect x="104" y="30" width="7" height="66" rx="3.5" fill="#3f4531" />
        <rect x="104" y="52" width="7" height="8" fill="#c9a86a" />
        <path d="M104 96 l3.5 12 l3.5 -12 z" fill="#c9a86a" />
      </g>
      {/* 葉 */}
      <path d="M28 132 C36 120 50 116 60 118 C52 130 40 136 28 132 Z" stroke="#6b8756" strokeWidth="1.4" fill="none" opacity="0.8" />
    </svg>
  )
}
