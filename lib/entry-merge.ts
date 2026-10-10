// 同じ日の日記がすでにあるときに、新しく書いた内容を「追記」としてまとめる（純粋関数）。
// 1日1件の設計のまま、あとから書いた分で前の言葉を消さないためのもの。
// 気分だけの記録（言葉がまだ無い）には追記せず、そのまま書き込む（hasWords が false）。
import { parseFreeform, serializeFreeform } from '@/lib/freeform'

/** DB に保存されている、その日の日記の言葉の部分 */
export interface StoredEntryText {
  events: string | null
  challenges: string | null
  gratitude: string | null
  freeform: string | null
  ai_draft: string | null
  edited_draft: string | null
  tags: string[] | null
}

/** これから保存する言葉の部分 */
export interface IncomingEntryText {
  events: string
  challenges: string
  gratitude: string
  freeform: string
  aiDraft: string
  editedDraft: string
  tags: string[]
}

/** 保存する列（diary_entries の列名） */
export interface MergedEntryText {
  events: string
  challenges: string
  gratitude: string
  freeform: string
  ai_draft: string
  edited_draft: string
  tags: string[]
}

export const MAX_MERGED_TAGS = 8

const TEXT_COLUMNS = ['events', 'challenges', 'gratitude', 'freeform', 'ai_draft', 'edited_draft'] as const

/** その日の記録に本人の言葉があるか（気分だけの記録なら false） */
export function hasWords(entry: Partial<StoredEntryText> | null | undefined): boolean {
  if (!entry) return false
  return TEXT_COLUMNS.some((col) => typeof entry[col] === 'string' && (entry[col] as string).trim().length > 0)
}

/** 前の言葉のあとに新しい言葉を足す（同じ内容の重複は足さない） */
export function appendText(before: string | null | undefined, after: string | null | undefined, separator: string): string {
  const a = (before ?? '').trim()
  const b = (after ?? '').trim()
  if (!a) return b
  if (!b || a === b || a.includes(b)) return a
  return `${a}${separator}${b}`
}

/** 前のタグのあとに新しいタグを足す（重複なし・上限あり） */
function unionTags(before: string[] | null | undefined, after: string[]): string[] {
  const out: string[] = []
  for (const t of [...(before ?? []), ...after]) {
    const tag = typeof t === 'string' ? t.trim() : ''
    if (tag && !out.includes(tag)) out.push(tag)
  }
  return out.slice(0, MAX_MERGED_TAGS)
}

/**
 * 既存の日記に、新しく書いた内容を追記した形を返す。
 * - 出来事・困ったこと・感謝: 前の言葉のあとに改行で足す
 * - 自由メモ: メモどうしは改行で足し、ふりかえり・あとからの一言はすべて残す
 * - 日記の本文（清書・原文）: 前の本文のあとに段落を空けて足す
 * - タグ: 両方を残す
 */
export function mergeEntryText(existing: StoredEntryText, incoming: IncomingEntryText): MergedEntryText {
  const before = parseFreeform(existing.freeform)
  const after = parseFreeform(incoming.freeform)
  const reflections = [...before.reflections]
  for (const r of after.reflections) {
    if (!reflections.some((x) => x.question === r.question && x.answer === r.answer)) reflections.push(r)
  }
  const freeform = serializeFreeform({
    memo: appendText(before.memo, after.memo, '\n'),
    reflections,
    laterNotes: [...before.laterNotes, ...after.laterNotes],
  })

  // 本文が片方の列にしか無い古い行（気分だけ → 本文だけ書き足した等）でも、前の本文を必ず残す
  const previousEdited = existing.edited_draft?.trim() || existing.ai_draft?.trim() || ''
  const previousAi = existing.ai_draft?.trim() || existing.edited_draft?.trim() || ''

  return {
    events: appendText(existing.events, incoming.events, '\n'),
    challenges: appendText(existing.challenges, incoming.challenges, '\n'),
    gratitude: appendText(existing.gratitude, incoming.gratitude, '\n'),
    freeform,
    ai_draft: appendText(previousAi, incoming.aiDraft, '\n\n'),
    edited_draft: appendText(previousEdited, incoming.editedDraft, '\n\n'),
    tags: unionTags(existing.tags, incoming.tags),
  }
}
