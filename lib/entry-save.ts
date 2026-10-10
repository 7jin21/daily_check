'use client'

// 日記の保存（ブラウザから Supabase へ。RLS で自分の行しか書けない）
import { getSupabaseClient } from '@/lib/supabase'
import { apiPost } from '@/lib/api-client'
import { hasWords, mergeEntryText, type MergedEntryText, type StoredEntryText } from '@/lib/entry-merge'

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
  /** 同じ日の日記に追記したか（false なら新規、または気分だけの記録に書き込んだ） */
  merged: boolean
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
        // 追記したときの要約・感情は、本文全体から refreshEntryMeta で作り直す（それまでは今回の分か前の分）
        summary: e.summary || (merged ? (existing?.summary as string | null) : null) || '',
        dominant_emotion: e.dominantEmotion || (merged ? (existing?.dominant_emotion as string | null) : null) || '',
      },
      // PK の id は渡していないため、user_id + entry_date で競合判定しないと同日2回目の保存が一意制約違反になる
      { onConflict: 'user_id,entry_date' }
    )
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return { id: data.id as string, merged, draft: text.edited_draft, tags: text.tags }
}

export interface EntryMeta {
  tags: string[]
  summary: string
  dominantEmotion: string
}

/**
 * 本文全体から要約・タグ・主要感情を作り直して保存する（追記したとき・言葉を書き足したとき）。
 * 失敗しても本文は保存済みなので null を返すだけにする。
 */
export async function refreshEntryMeta(entryId: string, draft: string): Promise<EntryMeta | null> {
  try {
    const meta = await apiPost<EntryMeta>('/api/draft-meta', { draft }, { retry: false })
    const { error } = await getSupabaseClient()
      .from('diary_entries')
      .update({ summary: meta.summary || null, tags: meta.tags, dominant_emotion: meta.dominantEmotion || null })
      .eq('id', entryId)
    if (error) throw new Error(error.message)
    return meta
  } catch (err) {
    console.warn('要約・タグの作り直しに失敗（本文は保存済み）:', err)
    return null
  }
}
