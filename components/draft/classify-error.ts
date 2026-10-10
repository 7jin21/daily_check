// 保存の失敗を、利用者に見せる言葉に置き換える（'cancelled' は何も見せない、「セッション」を含むならログインへ）
export function classifyError(err: unknown): string {
  if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
  if (err instanceof TypeError && err.message.includes('fetch')) {
    return 'ネットワークに接続できません。Wi-Fiやモバイルデータ通信を確認してください。'
  }
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
