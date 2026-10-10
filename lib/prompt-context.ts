// AI に渡す「日記データ」の文字列を作る（分析・週次レポート・AI に聞いてみる で共通）。
// 1行1日。欄ごとの文字数の上限は用途ごとに変える。

export interface PromptEntry {
  entry_date: string
  mood: number | null
  energy: number | null
  events: string | null
  challenges: string | null
  gratitude: string | null
  freeform: string | null
  dominant_emotion: string | null
}

/** 欄ごとに AI へ渡す最大文字数 */
export interface PromptLimits {
  events: number
  challenges: number
  gratitude: number
  freeform: number
}

/**
 * 例: [2026-10-10] 気分:4/5 エネルギー:3/5 / 出来事: … / 困ったこと: … / 感謝: … / メモ・ふりかえり: … / 感情: 満足
 * freeform には AI 内省ガイドの回答（【ふりかえり】）が畳まれているので「メモ・ふりかえり」として渡す。
 */
export function formatEntriesForPrompt(entries: PromptEntry[], limits: PromptLimits): string {
  return entries
    .map((e) => {
      const parts = [`[${e.entry_date}] 気分:${e.mood}/5 エネルギー:${e.energy}/5`]
      if (e.events?.trim()) parts.push(`出来事: ${e.events.substring(0, limits.events)}`)
      if (e.challenges?.trim()) parts.push(`困ったこと: ${e.challenges.substring(0, limits.challenges)}`)
      if (e.gratitude?.trim()) parts.push(`感謝: ${e.gratitude.substring(0, limits.gratitude)}`)
      if (e.freeform?.trim()) parts.push(`メモ・ふりかえり: ${e.freeform.substring(0, limits.freeform)}`)
      if (e.dominant_emotion?.trim()) parts.push(`感情: ${e.dominant_emotion}`)
      return parts.join(' / ')
    })
    .join('\n')
}
