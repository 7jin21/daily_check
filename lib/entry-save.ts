'use client'

// 日記の保存（ブラウザから Supabase へ。RLS で自分の行しか書けない）
import { getSupabaseClient } from '@/lib/supabase'

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

/** チェックインの内容と清書をまとめて保存し、行の id を返す（1日1件。同じ日なら上書き） */
export async function saveFullEntry(e: FullEntry): Promise<string> {
  const userId = await currentUserId()
  const { data, error } = await getSupabaseClient()
    .from('diary_entries')
    .upsert(
      {
        user_id: userId,
        entry_date: e.entryDate,
        mood: e.mood,
        energy: e.energy,
        events: e.events,
        challenges: e.challenges,
        gratitude: e.gratitude,
        freeform: e.freeform,
        ai_draft: e.aiDraft,
        edited_draft: e.editedDraft,
        tags: e.tags,
        summary: e.summary,
        dominant_emotion: e.dominantEmotion,
      },
      // PK の id は渡していないため、user_id + entry_date で競合判定しないと同日2回目の保存が一意制約違反になる
      { onConflict: 'user_id,entry_date' }
    )
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return data.id as string
}
