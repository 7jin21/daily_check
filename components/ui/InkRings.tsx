// 墨の輪（紙に落とした墨が、輪になって静かに広がる）。長い待ち（内省の問い・清書・分析）の印。
// スタイルは app/globals.css の .ink-rings。size: sm = 文字の横に添える大きさ / md = カードの中 / 指定なし = 画面の中央
export default function InkRings({ size }: { size?: 'sm' | 'md' }) {
  return (
    <span className="ink-rings" data-size={size} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
      <b />
    </span>
  )
}
