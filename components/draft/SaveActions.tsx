interface Props {
  willAppend: boolean // この日の日記がすでにあり、保存すると追記になる
  isSaving: boolean
  saveError: string | null
  saveDisabled: boolean
  showRegenerate: boolean
  regenerateDisabled: boolean
  onSave: () => void
  onRegenerate: () => void
}

// 保存まわり（保存の失敗・追記になることのお知らせ・保存ボタン・清書し直す）
export default function SaveActions({
  willAppend,
  isSaving,
  saveError,
  saveDisabled,
  showRegenerate,
  regenerateDisabled,
  onSave,
  onRegenerate,
}: Props) {
  return (
    <>
      {saveError && (
        <div
          className="mb-4 p-3 rounded-2xl text-sm"
          style={{ background: 'rgba(181,101,74,0.12)', border: '1px solid rgba(181,101,74,0.35)', color: '#9c4a2f' }}
        >
          <p className="font-semibold">保存できませんでした</p>
          <p className="mt-0.5 text-xs">{saveError}</p>
        </div>
      )}

      <div className="pb-6 space-y-3">
        {/* 上書きで前の言葉が消えると思わせないよう、保存の前に「追記になる」ことを伝える */}
        {willAppend && (
          <p className="p-3 rounded-2xl text-xs leading-relaxed bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--muted)]">
            この日の日記がすでにあります。保存すると、前の日記のあとに追記されます（前の内容は消えません）
          </p>
        )}
        <button
          onClick={onSave}
          disabled={saveDisabled}
          className="w-full py-4 rounded-full bg-[var(--accent)] text-[#f7f4ea] font-bold text-base disabled:opacity-40 active:scale-[0.99] transition-transform"
        >
          {isSaving ? '保存中...' : willAppend ? '追記して保存する 💾' : '保存する 💾'}
        </button>
        {showRegenerate && (
          <button
            onClick={onRegenerate}
            disabled={regenerateDisabled}
            className="w-full py-3 rounded-full border border-[var(--border)] text-[var(--muted)] text-base disabled:opacity-40"
          >
            🔄 清書し直す
          </button>
        )}
      </div>
    </>
  )
}
