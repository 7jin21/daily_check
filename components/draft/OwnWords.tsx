import type { KeptAnalysis } from '@/lib/draft-compose'

// 「あなたの言葉」がどれだけ残っているかを確かめる（清書係であって代筆者ではない、を目で見られるように）

/** 清書のうち本人の言葉が占める割合のメーター（押すと比べる画面を開く） */
export function OwnWordsMeter({ percent, open, onToggle }: { percent: number; open: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} aria-expanded={open} className="draft-kept">
      <span className="draft-kept-meter" aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </span>
      あなたの言葉 {percent}%
      <span className="text-[var(--muted-2)]">{open ? '▴' : '▾'}</span>
    </button>
  )
}

interface ComparePanelProps {
  segments: KeptAnalysis['segments']
  original: string
  keptPercent: number // メモのうち清書に残っている割合
  addedChars: number // AI が足した言葉の文字数（つなぎの助詞は除く）
  showUseRaw: boolean
  disabled: boolean
  onUseRaw: () => void
}

/** いまの本文（AI が足した言葉に印）と、本人のメモを並べて見せる */
export function ComparePanel({ segments, original, keptPercent, addedChars, showUseRaw, disabled, onUseRaw }: ComparePanelProps) {
  return (
    <div className="mt-3 card animate-fade-in" style={{ padding: 16 }}>
      <p className="text-xs font-bold text-[var(--muted)] tracking-wide">いまの本文</p>
      <p className="mt-2 text-[15px] leading-loose text-[var(--foreground)] whitespace-pre-wrap">
        {segments.map((s, i) =>
          s.added ? (
            // 文をつなぐだけの助詞は「AI の言葉」に数えないので、印も控えめにする
            <mark key={i} className={s.connector ? 'ai-joint' : 'ai-added'}>
              {s.text}
            </mark>
          ) : (
            <span key={i}>{s.text}</span>
          )
        )}
      </p>
      <p className="mt-2 text-xs text-[var(--muted)]">
        メモの {keptPercent}% を使っています・AIが足した言葉 {addedChars}字
      </p>
      <p className="mt-1 text-[11px] text-[var(--muted)]">
        <mark className="ai-added">下線</mark> はメモに無かった言葉、<mark className="ai-joint">点線</mark>{' '}
        は文をつなぐための助詞です。
      </p>
      <p className="mt-4 text-xs font-bold text-[var(--muted)] tracking-wide">あなたが書いたメモ</p>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted)] whitespace-pre-wrap">{original}</p>
      {showUseRaw && (
        <button type="button" onClick={onUseRaw} disabled={disabled} className="mt-3 draft-undo">
          メモのままにする
        </button>
      )}
    </div>
  )
}
