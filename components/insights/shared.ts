// インサイト画面の複数のセクションで使う、表示用の小さな部品

/** 気分（1〜5）ごとの色。添字がそのまま気分の値（0 は使わない） */
export const MOOD_COLOR = ['', '#b5654a', '#c5895f', '#cdbf9a', '#9caa7e', '#6f8a5f']

/** キャッシュした結果がどれくらい前に作られたか（「3時間前」など） */
export function formatAge(ts: number) {
  const m = Math.floor((Date.now() - ts) / 60000)
  if (m < 1) return 'たった今'
  if (m < 60) return `${m}分前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}時間前`
  return `${Math.floor(h / 24)}日前`
}
