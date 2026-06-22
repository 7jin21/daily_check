// ルートセグメント共通のローディングスケルトン
// サーバーコンポーネントのデータ取得中に白画面ではなくレイアウトの骨格を見せる
export default function Loading() {
  return (
    <div className="px-4 pt-6 pb-6 space-y-6" aria-busy="true" aria-label="読み込み中">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="skeleton h-7 w-48" />
          <div className="skeleton h-4 w-36" />
        </div>
        <div className="skeleton w-10 h-10 rounded-full" />
      </div>

      {/* CTAカード */}
      <div className="skeleton h-24 rounded-[3px]" />

      {/* 統計カード */}
      <div className="grid grid-cols-3 gap-3">
        <div className="skeleton h-24 rounded-[3px]" />
        <div className="skeleton h-24 rounded-[3px]" />
        <div className="skeleton h-24 rounded-[3px]" />
      </div>

      {/* コンテンツカード */}
      <div className="skeleton h-28 rounded-[3px]" />
      <div className="skeleton h-40 rounded-[3px]" />
    </div>
  )
}
