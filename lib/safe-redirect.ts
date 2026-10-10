// ログイン後の戻り先（?next=）を、このサイト内のパスだけに限る。
// 「https://自分のサイト」+ next をそのままつなぐと、next=@evil.com で外部サイトへ飛ばせてしまうため。

const PROBE_ORIGIN = 'https://inner-mirror.invalid'

/** next がこのサイト内の絶対パス（/〜）ならそのパスを、そうでなければ fallback を返す */
export function safeNextPath(next: string | null | undefined, fallback = '/'): string {
  if (typeof next !== 'string' || !next.startsWith('/')) return fallback
  try {
    // URL として解釈したときに別のオリジンになるもの（//evil.com、/\evil.com、タブや改行入り等）は弾く
    const url = new URL(next, PROBE_ORIGIN)
    if (url.origin !== PROBE_ORIGIN) return fallback
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return fallback
  }
}
