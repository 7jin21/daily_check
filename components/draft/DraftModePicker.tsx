import { DRAFT_MODES, type DraftMode } from '@/lib/draft-compose'

// 整え方（原文のまま / 整える / 箇条書き）の切り替え
export default function DraftModePicker({
  mode,
  disabled,
  onSelect,
}: {
  mode: DraftMode
  disabled: boolean
  onSelect: (mode: DraftMode) => void
}) {
  return (
    <div className="mb-4">
      <div role="radiogroup" aria-label="整え方" className="draft-modes">
        {DRAFT_MODES.map((m) => (
          <button
            key={m.value}
            role="radio"
            aria-checked={mode === m.value}
            data-active={mode === m.value}
            onClick={() => onSelect(m.value)}
            disabled={disabled}
            className="draft-mode"
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-[var(--muted)] px-1">{DRAFT_MODES.find((m) => m.value === mode)?.hint}</p>
    </div>
  )
}
