export type RewriteInstruction = 'emotional' | 'shorter' | 'positive' | 'formal'

const REWRITE_BUTTONS: { key: RewriteInstruction; label: string }[] = [
  { key: 'emotional', label: '感情豊かに ✨' },
  { key: 'shorter', label: '短くして 📝' },
  { key: 'positive', label: 'ポジティブに 🌟' },
  { key: 'formal', label: '丁寧な文体に 📖' },
]

interface Props {
  activeKey: RewriteInstruction | null // 書き直し中の指示
  disabled: boolean
  error: string | null
  onRewrite: (instruction: RewriteInstruction) => void
}

// AI書き直し（任意。AI らしく膨らませたい日に。言葉が変わることを先に伝える）
export default function RewriteButtons({ activeKey, disabled, error, onRewrite }: Props) {
  return (
    <div className="mt-5">
      <p className="text-xs text-[var(--muted-2)] mb-2">AIに書き直してもらう（言葉が変わります）</p>
      <div className="flex flex-wrap gap-2">
        {REWRITE_BUTTONS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onRewrite(key)}
            disabled={disabled}
            className="px-3 py-1.5 rounded-full text-xs font-medium border border-[var(--border)] text-[var(--muted)] bg-[var(--surface)] disabled:opacity-40 active:scale-95 transition-transform"
          >
            {activeKey === key ? '書き直し中...' : label}
          </button>
        ))}
      </div>
      {error && (
        <p className="mt-2 text-xs" style={{ color: '#9c4a2f' }}>
          {error}
        </p>
      )}
    </div>
  )
}
