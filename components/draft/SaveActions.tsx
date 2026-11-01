import { AlertIcon, InfoIcon, RefreshIcon } from '@/components/ui/icons'

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
        <div className="notice mb-4" data-tone="danger" role="alert">
          <AlertIcon size={18} />
          <p>
            <b>保存できませんでした</b>
            {saveError}
          </p>
        </div>
      )}

      <div className="dv-actions space-y-3" style={{ paddingTop: 4 }}>
        {/* 上書きで前の言葉が消えると思わせないよう、保存の前に「追記になる」ことを伝える */}
        {willAppend && (
          <div className="notice">
            <InfoIcon size={18} />
            <p>この日の日記がすでにあります。保存すると、前の日記のあとに追記されます（前の内容は消えません。同じ内容をもう一度保存しても二重にはなりません）</p>
          </div>
        )}
        <button type="button" onClick={onSave} disabled={saveDisabled} className="btn btn-primary btn-block">
          {isSaving ? '保存しています…' : willAppend ? '追記して保存する' : '保存する'}
        </button>
        {showRegenerate && (
          <button type="button" onClick={onRegenerate} disabled={regenerateDisabled} className="btn btn-secondary btn-block">
            <RefreshIcon size={18} />
            清書し直す
          </button>
        )}
      </div>
    </>
  )
}
