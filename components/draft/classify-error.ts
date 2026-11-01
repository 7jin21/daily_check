import { ApiError } from '@/lib/api-client'
import { isNetworkFailure } from '@/lib/network-error'

export const NETWORK_ERROR_MESSAGE = 'ネットワークに接続できません。Wi-Fiやモバイルデータ通信を確認してください。'

// 保存の失敗を、利用者に見せる言葉に置き換える（'cancelled' は何も見せない、「セッション」を含むならログインへ）
export function classifyError(err: unknown): string {
  if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
  // 通信の失敗は「未ログイン」より先に見分ける（Safari の「Load failed」なども含む）。
  // ここで拾わないと、電波が弱いだけでログイン画面へ飛ばしたり、英語のエラーをそのまま見せたりする
  if (isNetworkFailure(err)) return NETWORK_ERROR_MESSAGE
  if (err instanceof Error) {
    if (err.message.includes('401') || err.message.includes('Unauthorized')) {
      return 'セッションが切れました。再ログインしてください。'
    }
    if (err.message.includes('500') || err.message.includes('Server error')) {
      return 'サーバーで問題が発生しました。時間をおいて再試行してください。'
    }
    return err.message
  }
  return '保存に失敗しました。時間をおいて再試行してください。'
}

// AI 書き直しの失敗を、利用者に見せる言葉にする。
// 長すぎる（400 / 413）は時間をおいても同じ結果になるので、「再試行してください」ではなく理由を見せる
export function rewriteErrorMessage(err: unknown): string {
  if (err instanceof ApiError && (err.status === 400 || err.status === 413)) return err.message
  if (isNetworkFailure(err)) return NETWORK_ERROR_MESSAGE
  return 'AIの書き直しに失敗しました。しばらくしてから再試行してください。'
}
