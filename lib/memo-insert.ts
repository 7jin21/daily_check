// 「今日のひとこと」「今日の予定」を「今日あったこと」に入れる（純粋関数）。
// 欄の上限（500字）を超える分を黙って切り捨てない: 入る行だけを入れ、入らなかった件数を返す。
// 保存のあとに片付けるのは、日記に入ったメモだけ（入りきらなかった・選ばなかったメモは消さない）

/**
 * base のあとに lines を1行ずつ足す。足すと max を超える行は足さずに飛ばす（行の途中では切らない）。
 * 何も足せなかったときは base をそのまま返す
 */
export function appendLinesWithin(base: string, lines: string[], max: number): { text: string; added: number; skipped: number } {
  let text = base.trimEnd()
  let added = 0
  for (const line of lines) {
    const next = text ? `${text}\n${line}` : line
    if (next.length > max) continue
    text = next
    added++
  }
  return { text: added ? text : base, added, skipped: lines.length - added }
}

/** 日記に入ったメモ（その文言がそのまま本文・メモ欄に含まれているもの）。保存のあとに片付けてよいのはこれだけ */
export function memosUsedIn<T extends { text: string }>(memos: T[], text: string): T[] {
  return memos.filter((m) => {
    const t = m.text.trim()
    return t.length > 0 && text.includes(t)
  })
}
