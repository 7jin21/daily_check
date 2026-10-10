// 同じ日の日記がすでにあるときに、新しく書いた内容を「追記」としてまとめる（純粋関数）。
// 1日1件の設計のまま、あとから書いた分で前の言葉を消さないためのもの。
// 気分だけの記録（言葉がまだ無い）には追記せず、そのまま書き込む（hasWords が false）。
import { splitFreeformMemo } from '@/lib/freeform'

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

/**
 * 前の言葉のあとに新しい言葉を足す。
 * 前の言葉は書かれたまま残し（末尾の空白・改行だけ落としてつなぐ）、新しい言葉も字下げなどはそのまま使う。
 * 足さないのは「同じ保存のやり直し」（前の言葉そのもの、または前の言葉の末尾にすでに足してある）だけ。
 * 前の文の一部と同じ短い言葉（朝「会議で疲れた」・夜「疲れた」）は、別のときの言葉として足す。
 */
export function appendText(before: string | null | undefined, after: string | null | undefined, separator: string): string {
  const a = (before ?? '').trimEnd()
  const b = (after ?? '').replace(/^\s*\n/, '').trimEnd()
  // やり直しの判定は前後の空白を除いて比べる（保存のたびに空白の扱いが違っても重複させない）
  const ta = a.trim()
  const tb = b.trim()
  if (!ta) return tb ? b : ''
  if (!tb || ta === tb || a.endsWith(`${separator}${b}`) || ta.endsWith(`${separator}${tb}`)) return a
  return `${a}${separator}${b}`
}

/**
 * 自由メモ欄を追記する。前の欄の文字列はそのまま残し（組み直さない）、
 * 新しいメモは前のメモのあと（ふりかえり・あとからの一言より前）に、新しいふりかえりは末尾に足す。
 * 新しいメモが無い（または同じ保存のやり直し）なら、前の欄は一字も変えない。
 */
export function mergeFreeform(before: string | null | undefined, after: string | null | undefined): string {
  const prevRaw = before ?? ''
  const prev = splitFreeformMemo(prevRaw)
  const next = splitFreeformMemo(after)
  const rest = prev.rest.trimEnd()
  const newRest = next.rest.trim()
  // 同じふりかえりを二度足さない（保存のやり直しなど）
  const addRest = !!newRest && rest.trim() !== newRest && !rest.endsWith(`\n\n${newRest}`)

  const memo = appendText(prev.memo, next.memo, '\n')
  if (memo === prev.memo.trimEnd()) {
    if (!addRest) return prevRaw
    return prevRaw.trim() ? `${prevRaw.trimEnd()}\n\n${newRest}` : newRest
  }
  return [memo, rest, addRest ? newRest : ''].filter((part) => part.trim()).join('\n\n')
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

/** /api/draft-meta が受け取れる本文の長さ（route 側の上限） */
export const META_INPUT_LIMIT = 3000

/**
 * 要約・タグを作るために AI へ渡す本文。長い日（追記で伸びた日など）は、
 * 上限に収まるよう始まりと終わりを残して間を省く（上限を超えると要約を作れないため）。
 */
export function metaExcerpt(text: string, limit: number = META_INPUT_LIMIT): string {
  if (text.length <= limit) return text
  const gap = '\n…\n'
  const head = Math.floor((limit - gap.length) / 2)
  const tail = limit - gap.length - head
  return `${text.slice(0, head)}${gap}${text.slice(text.length - tail)}`
}

/**
 * 既存の日記に、新しく書いた内容を追記した形を返す。
 * - 出来事・困ったこと・感謝: 前の言葉のあとに改行で足す
 * - 自由メモ: メモどうしは改行で足し、ふりかえり・あとからの一言は書かれたまま残す（mergeFreeform）
 * - 日記の本文（清書・原文）: 前の本文のあとに段落を空けて足す
 * - タグ: 両方を残す
 */
export function mergeEntryText(existing: StoredEntryText, incoming: IncomingEntryText): MergedEntryText {
  const freeform = mergeFreeform(existing.freeform, incoming.freeform)

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
