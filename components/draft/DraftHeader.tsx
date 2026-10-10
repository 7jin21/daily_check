import { formatJSTDate } from '@/lib/jst'

// 下書き画面の見出し。過去日付の書き忘れ救済なら、どの日の日記かを見出しに出す
export default function DraftHeader({ targetDate, onBack }: { targetDate: string | null; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <button
        onClick={onBack}
        className="w-11 h-11 rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] flex items-center justify-center text-xl text-[var(--foreground)]"
        aria-label="入力に戻る"
      >
        ‹
      </button>
      <h1 className="text-xl font-bold text-[var(--foreground)]">
        {targetDate ? `${formatJSTDate(targetDate, { month: 'long', day: 'numeric' })}の日記のドラフト` : '日記のドラフト'}
      </h1>
    </div>
  )
}
