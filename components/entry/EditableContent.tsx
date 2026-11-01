'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase'
import { apiPost } from '@/lib/api-client'
import { refreshEntryMeta } from '@/lib/entry-save'
import { todaysMemos, useMemoStore } from '@/stores/memos'
import { PlusIcon } from '@/components/ui/icons'

interface Props {
  entryId: string
  initialContent: string // 空なら「気分だけの記録」→ あとから書き足せる
  // Notion 再同期用のメタデータ（編集内容を Notion ページにも反映する）
  entryDate: string
  mood: number | null
  energy: number | null
  tags: string[]
  /** 最初から書き足しモードで開く（ホームの「言葉を書き足す」から来たとき） */
  autoEdit?: boolean
  /** 要約・タグがまだ無い（気分だけの記録）→ 保存後に本文から補う */
  needsMeta?: boolean
  /** 今日の日記なら、日中の「ひとこと」を入れられる */
  isToday?: boolean
}

export default function EditableContent({
  entryId,
  initialContent,
  entryDate,
  mood,
  energy,
  tags,
  autoEdit = false,
  needsMeta = false,
  isToday = false,
}: Props) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(autoEdit)
  const [saved, setSaved] = useState(initialContent)
  const [draft, setDraft] = useState(initialContent)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [memosInserted, setMemosInserted] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const memoState = useMemoStore()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const memos = mounted && isToday && !memosInserted ? [...todaysMemos(memoState, entryDate)].reverse() : []

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [draft, isEditing])

  // Focus on open
  useEffect(() => {
    if (isEditing) textareaRef.current?.focus()
  }, [isEditing])

  const insertMemos = () => {
    const lines = memos.map((m) => `${m.time} ${m.text}`).join('\n')
    setDraft((d) => (d.trim() ? `${d.trimEnd()}\n${lines}` : lines))
    setMemosInserted(true)
  }

  const handleSave = async () => {
    if (!draft.trim() || saving) return
    setSaving(true)
    setError(null)
    try {
      const supabase = getSupabaseClient()
      const { error: dbErr } = await supabase.from('diary_entries').update({ edited_draft: draft }).eq('id', entryId)
      if (dbErr) throw dbErr
      setSaved(draft)
      setIsEditing(false)
      // 日記に入ったメモだけを片付ける（入れたあとに消した行のメモは残す）
      if (memosInserted && memoState.date === entryDate) memoState.removeUsedIn(draft)

      // 気分だけの記録に言葉を足したときは、要約・タグ・感情を本文から補う（一覧やホームの表示・分析に使う）
      // （失敗しても本文は保存済み。タグは今のまま Notion へ送る）
      let nextTags = tags
      if (needsMeta) {
        const meta = await refreshEntryMeta(entryId, draft)
        if (meta?.tags) nextTags = meta.tags
      }

      // Notion にも編集内容を反映（同期済みページは更新される。失敗しても保存には影響しない）
      if (mood != null && energy != null) {
        apiPost('/api/notion-sync', { entryId, entryDate, draft, tags: nextTags, mood, energy }, { retry: false }).catch(
          (syncErr) => console.warn('Notion再同期失敗（無視）:', syncErr)
        )
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setDraft(saved)
    setIsEditing(false)
    setError(null)
    setMemosInserted(false)
  }

  // 気分だけの記録（本文なし）
  if (!saved && !isEditing) {
    return (
      <div className="card mb-6 text-center" style={{ padding: '28px 20px' }}>
        <h2 className="eyebrow mb-2">Diary</h2>
        <p className="font-mincho text-base text-[var(--foreground)]">この日は、気分だけ残しています。</p>
        <p className="text-xs font-ui text-[var(--muted)] mt-1.5">思い出したことがあれば、あとから言葉を書き足せます。</p>
        <button type="button" onClick={() => setIsEditing(true)} className="btn btn-primary btn-sm mt-4">
          言葉を書き足す
        </button>
      </div>
    )
  }

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="eyebrow">Diary</h2>
        {!isEditing && (
          <button type="button" onClick={() => setIsEditing(true)} className="btn-quiet" style={{ minHeight: 32, color: 'var(--primary)' }}>
            編集する
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="animate-fade-in">
          {memos.length > 0 && (
            <button type="button" onClick={insertMemos} className="chip mb-2" style={{ color: 'var(--primary)', fontWeight: 700 }}>
              <PlusIcon size={14} />
              今日のひとこと（{memos.length}件）を入れる
            </button>
          )}
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={saved ? undefined : '今日のこと、思い出したことを、あなたの言葉で'}
            className="w-full min-h-36 p-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] font-mincho resize-none overflow-hidden focus:outline-none focus:ring-2 focus:ring-[var(--primary)] leading-loose"
          />
          {error && (
            <p className="mt-1.5 text-xs text-[var(--danger)]" role="alert">
              {error}
            </p>
          )}
          <div className="flex gap-2 mt-3">
            <button type="button" onClick={handleSave} disabled={saving || !draft.trim()} className="btn btn-primary btn-sm flex-1">
              {saving ? '保存しています…' : '保存する'}
            </button>
            <button type="button" onClick={handleCancel} className="btn btn-secondary btn-sm">
              やめる
            </button>
          </div>
        </div>
      ) : (
        <p className="font-mincho text-base text-[var(--foreground)] whitespace-pre-wrap leading-loose prose-ja">{saved}</p>
      )}
    </div>
  )
}
