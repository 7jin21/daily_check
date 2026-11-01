export type RewriteInstruction = 'emotional' | 'shorter' | 'positive' | 'formal'

const REWRITE_BUTTONS: { key: RewriteInstruction; label: string }[] = [
  { key: 'emotional', label: '感情豊かに' },
  { key: 'shorter', label: '短くして' },
  { key: 'positive', label: 'ポジティブに' },
  { key: 'formal', label: '丁寧な文体に' },
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
    <div className="mt-6">
      <p className="label-ui mb-2" id="dv-rewrite-label">
        AI に書き直してもらう（言葉が変わります）
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-labelledby="dv-rewrite-label">
        {REWRITE_BUTTONS.map(({ key, label }) => (
          <button key={key} type="button" onClick={() => onRewrite(key)} disabled={disabled} className="chip" aria-busy={activeKey === key}>
            {activeKey === key ? (
              <>
                <span className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} aria-hidden="true" />
                書き直しています
              </>
            ) : (
              label
            )}
          </button>
        ))}
      </div>
      {error && (
        <p className="mt-2 text-xs text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
