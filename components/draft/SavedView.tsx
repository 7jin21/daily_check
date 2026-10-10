import Link from 'next/link'
import Confetti from '@/components/ui/Confetti'

interface Props {
  entryDate: string
  merged: boolean // 同じ日の日記に追記した（前の言葉は残っている）
  isToday: boolean
  showReminderNudge: boolean
}

// 保存したあとの画面。追記したときは「上書きではなく、前の日記に足した」ことが分かる見出しにする
export default function SavedView({ entryDate, merged, isToday, showReminderNudge }: Props) {
  const title = merged ? (isToday ? '今日の日記に追記しました' : 'この日の日記に追記しました') : '保存しました！'

  return (
    <>
      <Confetti />
      <div className="min-h-dvh flex flex-col items-center justify-center px-4 gap-6 animate-fade-in">
        <div className="text-7xl animate-float">✨</div>
        <div className="text-center">
          <p className="font-bold text-[var(--foreground)] text-2xl">{title}</p>
          <p className="text-[var(--muted)] text-sm mt-1">今日も記録できました</p>
        </div>
        <div className="w-full space-y-3">
          <Link
            href={`/entries/${entryDate}`}
            className="block w-full py-4 text-center rounded-full bg-[var(--accent)] text-[#f7f4ea] font-bold text-base active:scale-[0.99] transition-transform glow-sky"
          >
            日記を見る
          </Link>
          <Link
            href="/"
            className="block w-full py-3 text-center rounded-full border border-[var(--border)] text-[var(--muted)] text-base active:scale-95 transition-transform"
          >
            ホームに戻る
          </Link>
          {/* 記録の習慣化ナッジ: リマインダー未設定の場合のみ */}
          {showReminderNudge && (
            <Link
              href="/settings"
              className="block w-full py-2 text-center text-xs text-[var(--muted)] underline underline-offset-2"
            >
              🔔 リマインダーを設定して、記録を習慣にする
            </Link>
          )}
        </div>
      </div>
    </>
  )
}
