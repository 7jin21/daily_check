// 通信の失敗（電波が無い・サーバーに届かない）を、それ以外の失敗（未ログイン・入力の誤りなど）と区別する。
// 未ログインと取り違えると、電波が弱いだけで「セッションが切れました」と出てログイン画面へ飛ばしてしまう

/** 通信の失敗（時間をおいて、または電波のある所でもう一度試せばよい） */
export class NetworkError extends Error {
  constructor(message = 'Network error') {
    super(message)
    this.name = 'NetworkError'
  }
}

// 実行環境ごとの「通信に失敗した」ときの文言。Supabase の DB 呼び出しは「TypeError: Load failed」のように
// 例外の名前つきの文字列にして返すので、文言で見分ける
// Safari: Load failed ／ Chrome: Failed to fetch ／ Firefox: NetworkError when attempting to fetch resource. ／ Node: fetch failed
const NETWORK_MESSAGE = /load failed|failed to fetch|networkerror when|network request failed|fetch failed|^fetcherror:/i

/** 通信の失敗か（投げられた例外・Supabase が返すエラーのどちらでも判定できる） */
export function isNetworkFailure(err: unknown): boolean {
  if (err instanceof NetworkError) return true
  if (!err || typeof err !== 'object') return false
  const e = err as { name?: unknown; message?: unknown }
  // Supabase Auth（getUser など）は、通信の失敗を AuthRetryableFetchError として返す（user は null になる）
  if (e.name === 'AuthRetryableFetchError') return true
  return typeof e.message === 'string' && NETWORK_MESSAGE.test(e.message.trim())
}
