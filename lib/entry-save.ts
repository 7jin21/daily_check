'use client'

// 日記の保存（ブラウザから Supabase へ。RLS で自分の行しか書けない）
import { getSupabaseClient } from '@/lib/supabase'
import { apiPost } from '@/lib/api-client'
import { hasWords, mergeEntryText, metaExcerpt, type MergedEntryText, type StoredEntryText } from '@/lib/entry-merge'

async function currentUserId(): Promise<string> {
  const supabase = getSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  return user.id
}

/**
 * 気分とエネルギーだけを記録する（本文・AI 清書はあとから書き足せる）。
 * upsert に渡した列だけが更新されるので、同じ日にすでに本文があっても消さない。
 */
export async function saveMoodOnly(entryDate: string, mood: number, energy: number): Promise<void> {
  const userId = await currentUserId()
  const { error } = await getSupabaseClient()
    .from('diary_entries')
    .upsert({ user_id: userId, entry_date: entryDate, mood, energy }, { onConflict: 'user_id,entry_date' })
  if (error) throw new Error(error.message)
}

/** その日にすでに言葉のある日記があるか（あれば保存は「追記」になる） */
export async function hasEntryWithWords(entryDate: string): Promise<boolean> {
  const userId = await currentUserId()
  const { data, error } = await getSupabaseClient()
    .from('diary_entries')
    .select('events, challenges, gratitude, freeform, ai_draft, edited_draft')
    .eq('user_id', userId)
    .eq('entry_date', entryDate)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return hasWords(data as Partial<StoredEntryText> | null)
}

export interface FullEntry {
  entryDate: string
  mood: number | null
  energy: number | null
  events: string
  challenges: string
  gratitude: string
  freeform: string
  aiDraft: string
  editedDraft: string
  tags: string[]
  summary: string
  dominantEmotion: string
}

export interface SaveResult {
  id: string
  /** 同じ日の日記に言葉があり、追記として保存したか（false なら新規、または気分だけの記録に書き込んだ） */
  merged: boolean
  /** 追記で実際に言葉が足されたか（保存のやり直しで何も変わらなかったときは false） */
  appended: boolean
  /** 保存された日記の本文（追記したときは前の本文＋今回の本文） */
  draft: string
  tags: string[]
}

/**
 * チェックインの内容と清書を保存し、行の id を返す（1日1件）。
 * 同じ日に言葉のある日記がすでにあれば、上書きせずに追記する（前の言葉を消さない）。
 */
export async function saveFullEntry(e: FullEntry): Promise<SaveResult> {
  const userId = await currentUserId()
  const supabase = getSupabaseClient()

  const { data: existing, error: readError } = await supabase
    .from('diary_entries')
    .select('events, challenges, gratitude, freeform, ai_draft, edited_draft, tags, summary, dominant_emotion')
    .eq('user_id', userId)
    .eq('entry_date', e.entryDate)
    .maybeSingle()
  if (readError) throw new Error(readError.message)

  const merged = hasWords(existing as Partial<StoredEntryText> | null)
  const text: MergedEntryText = merged
    ? mergeEntryText(existing as StoredEntryText, e)
    : {
        events: e.events,
        challenges: e.challenges,
        gratitude: e.gratitude,
        freeform: e.freeform,
        ai_draft: e.aiDraft,
        edited_draft: e.editedDraft,
        tags: e.tags,
      }

  const { data, error } = await supabase
    .from('diary_entries')
    .upsert(
      {
        user_id: userId,
        entry_date: e.entryDate,
        mood: e.mood,
        energy: e.energy,
        ...text,
        // 追記したときは、前の要約・感情を残しておき、本文全体から refreshEntryMeta で作り直す
        // （作り直せなかったときに、今回の分だけの要約で一日を上書きしないため）
        summary: merged ? (existing?.summary as string | null) || e.summary : e.summary,
        dominant_emotion: merged ? (existing?.dominant_emotion as string | null) || e.dominantEmotion : e.dominantEmotion,
      },
      // PK の id は渡していないため、user_id + entry_date で競合判定しないと同日2回目の保存が一意制約違反になる
      { onConflict: 'user_id,entry_date' }
    )
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  const appended =
    merged &&
    (['events', 'challenges', 'gratitude', 'freeform', 'ai_draft', 'edited_draft'] as const).some(
      // 末尾の空白・改行の違いは「足された」に数えない（つなぐときに末尾だけ整えるため）
      (col) => (text[col] ?? '').trimEnd() !== (((existing as Partial<StoredEntryText>)[col] as string | null) ?? '').trimEnd()
    )
  return { id: data.id as string, merged, appended, draft: text.edited_draft, tags: text.tags }
}

interface DraftMeta {
  tags?: string[]
  summary?: string
  dominantEmotion?: string
}

/** 作り直して保存できた要約・タグ・感情（作れなかった項目は null。DB の値はそのまま） */
export interface RefreshedMeta {
  tags: string[] | null
  summary: string | null
  dominantEmotion: string | null
}

/**
 * 本文全体から要約・タグ・主要感情を作り直して保存する（追記したとき・言葉を書き足したとき）。
 * /api/draft-meta は AI が使えないとき（未設定・失敗）も 200 で空の結果を返すので、
 * 空の項目は書かない（前の要約・タグを空で上書きして消さない）。
 * 何も作れなかった・失敗したときは null（本文は保存済み）。
 */
export async function refreshEntryMeta(entryId: string, draft: string): Promise<RefreshedMeta | null> {
  try {
    const meta = await apiPost<DraftMeta>('/api/draft-meta', { draft: metaExcerpt(draft) }, { retry: false })
    const refreshed: RefreshedMeta = {
      tags: Array.isArray(meta.tags) && meta.tags.length > 0 ? meta.tags : null,
      summary: meta.summary?.trim() || null,
      dominantEmotion: meta.dominantEmotion?.trim() || null,
    }
    const update: Record<string, unknown> = {}
    if (refreshed.tags) update.tags = refreshed.tags
    if (refreshed.summary) update.summary = refreshed.summary
    if (refreshed.dominantEmotion) update.dominant_emotion = refreshed.dominantEmotion
    if (Object.keys(update).length === 0) return null

    const { error } = await getSupabaseClient().from('diary_entries').update(update).eq('id', entryId)
    if (error) throw new Error(error.message)
    return refreshed
  } catch (err) {
    console.warn('要約・タグの作り直しに失敗（本文は保存済み）:', err)
    return null
  }
}
