// ルートセグメント共通のローディング表示。
// どの画面にも合うよう、中央で小さな月がゆっくり明滅するだけにする（白画面や古い骨組みを見せない）
export default function Loading() {
  return (
    <div className="min-h-[70dvh] flex items-center justify-center" aria-busy="true" aria-label="読み込み中">
      <span className="loading-moon" />
    </div>
  )
}
