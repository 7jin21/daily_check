// インサイト画面の複数のセクションで使う、表示用の小さな部品

/** 気分（1〜5）ごとの色（CSS 変数）。添字がそのまま気分の値（0 は使わない） */
export const MOOD_COLOR = ['', 'var(--mood-1)', 'var(--mood-2)', 'var(--mood-3)', 'var(--mood-4)', 'var(--mood-5)']

/** キャッシュした結果がどれくらい前に作られたか（「3時間前」など） */
export function formatAge(ts: number) {
  const m = Math.floor((Date.now() - ts) / 60000)
  if (m < 1) return 'たった今'
  if (m < 60) return `${m}分前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}時間前`
  return `${Math.floor(h / 24)}日前`
}
