import { formatJSTDate } from '@/lib/jst'
import { ChevronLeftIcon } from '@/components/ui/icons'

// 下書き画面の見出し。過去日付の書き忘れ救済なら、どの日の日記かを見出しに出す
export default function DraftHeader({ targetDate, onBack }: { targetDate: string | null; onBack: () => void }) {
  return (
    <header className="dv-head">
      <button type="button" onClick={onBack} className="icon-btn" aria-label="入力に戻る">
        <ChevronLeftIcon />
      </button>
      <h1>
        {targetDate ? `${formatJSTDate(targetDate, { month: 'long', day: 'numeric' })}の日記` : '今日の日記'}
      </h1>
    </header>
  )
}
