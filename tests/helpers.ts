// テスト用の小さな道具

/**
 * プロセスのタイムゾーンを一時的に切り替えて fn を実行する（終わったら必ず戻す）。
 * Node は process.env.TZ への代入をその場で反映する。日付の計算が端末・サーバーの TZ に左右されないことを確かめるために使う
 */
export function withTZ<T>(tz: string, fn: () => T): T {
  const prev = process.env.TZ
  process.env.TZ = tz
  try {
    return fn()
  } finally {
    if (prev === undefined) delete process.env.TZ
    else process.env.TZ = prev
  }
}

/** 日本・UTC（Vercel）・日付変更線の反対側（アメリカ西海岸）。日付がずれやすい組み合わせ */
export const TIME_ZONES = ['Asia/Tokyo', 'UTC', 'America/Los_Angeles'] as const
