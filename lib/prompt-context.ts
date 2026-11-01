// AI に渡す「日記データ」の文字列を作る（分析・週次レポート・AI に聞いてみる で共通）。
// 1行1日。欄ごとの文字数の上限は用途ごとに変える。
import { cleanReflectionAnswer, parseFreeform } from '@/lib/freeform'

export interface PromptEntry {
  entry_date: string
  mood: number | null
  energy: number | null
  events: string | null
  challenges: string | null
  gratitude: string | null
  freeform: string | null
  dominant_emotion: string | null
  /** 日記の本文（本文にしか言葉が無い日だけ材料にする。ownBodyText） */
  edited_draft?: string | null
  /** AI の清書（ある日は本文に AI の言葉が混ざるので、本文を本人の言葉として渡さない） */
  ai_draft?: string | null
}

/** 欄ごとに AI へ渡す最大文字数 */
export interface PromptLimits {
  events: number
  challenges: number
  gratitude: number
  /** 自由メモ（ふりかえり・あとからの一言を除いた、本人のメモの部分） */
  freeform: number
  /** ふりかえりの答え・あとからの一言の1件ごと（メモとは別枠。メモが長くても必ず渡す） */
  reflection: number
  /** 本文にしか言葉が無い日の本文 */
  body: number
}

/** 絵文字など（サロゲートペア）を割らずに、先頭から n 文字までにする */
function clip(s: string, n: number): string {
  const chars = Array.from(s)
  return chars.length > n ? chars.slice(0, n).join('') : s
}

/**
 * 本文にしか言葉が無い日（気分だけの記録に、あとから日記の画面で言葉を書き足した日）の本文。
 * メモ欄に言葉がある日と、AI の清書が関わった日（ai_draft がある日）は空を返す。
 * （清書には AI の言葉が混ざるので、本人の言葉としては渡さない。メモ欄がある日はメモ欄が本人の言葉）
 */
export function ownBodyText(e: Pick<PromptEntry, 'events' | 'challenges' | 'gratitude' | 'freeform' | 'edited_draft' | 'ai_draft'>): string {
  const memo = parseFreeform(e.freeform).memo
  if ([e.events, e.challenges, e.gratitude, memo].some((s) => s?.trim())) return ''
  if (e.ai_draft?.trim()) return ''
  return (e.edited_draft ?? '').trim()
}

/**
 * 例: [2026-10-10] 気分:4/5 エネルギー:3/5 / 出来事: … / 困ったこと: … / 感謝: … / メモ: … / 【ふりかえり】問い → 答え / 感情: 満足
 * freeform に畳んである AI 内省ガイドの回答（【ふりかえり】）と「あとから」の一言は、メモとは分けて1件ずつ渡す
 * （以前は自由メモを先頭から切っていたため、メモが長い日はうしろに保存されたふりかえりが届かなかった）。
 * 本文にしか言葉が無い日は、その本文を「日記」として渡す。
 */
export function formatEntriesForPrompt(entries: PromptEntry[], limits: PromptLimits): string {
  return entries
    .map((e) => {
      const parts = [`[${e.entry_date}] 気分:${e.mood}/5 エネルギー:${e.energy}/5`]
      const ff = parseFreeform(e.freeform)
      if (e.events?.trim()) parts.push(`出来事: ${clip(e.events, limits.events)}`)
      if (e.challenges?.trim()) parts.push(`困ったこと: ${clip(e.challenges, limits.challenges)}`)
      if (e.gratitude?.trim()) parts.push(`感謝: ${clip(e.gratitude, limits.gratitude)}`)
      if (ff.memo) parts.push(`メモ: ${clip(ff.memo, limits.freeform)}`)
      for (const r of ff.reflections) {
        // 以前の版で保存された「どれも近くない」は答えに数えない
        const answer = cleanReflectionAnswer(r.answer)
        if (answer) parts.push(`【ふりかえり】${clip(r.question, 80)} → ${clip(answer, limits.reflection)}`)
      }
      for (const n of ff.laterNotes) parts.push(`【あとから ${n.date}】${clip(n.text, limits.reflection)}`)
      const body = ownBodyText(e)
      if (body) parts.push(`日記: ${clip(body, limits.body)}`)
      if (e.dominant_emotion?.trim()) parts.push(`感情: ${e.dominant_emotion}`)
      return parts.join(' / ')
    })
    .join('\n')
}

/** AI への説明（各ルートのシステムプロンプトに入れる）: 日記データの印の意味 */
export const PROMPT_ENTRY_LEGEND =
  '【ふりかえり】で始まる部分は、AI の問いに本人が答えた内省の記録です（感情の理由・価値観・判断基準を読み取る最も重要な材料）。' +
  '【あとから 日付】は、後日その日の日記に本人が添えた一言です。「日記:」は、本人が日記の画面に直接書いた言葉です。'
