'use client'

import { useEffect, useRef, useState } from 'react'
import { getSupabaseClient } from '@/lib/supabase'
import { apiPost } from '@/lib/api-client'

interface Props {
  entryId: string
  initialContent: string
  // Notion 再同期用のメタデータ（編集内容を Notion ページにも反映する）
  entryDate: string
  mood: number | null
  energy: number | null
  tags: string[]
}

export default function EditableContent({ entryId, initialContent, entryDate, mood, energy, tags }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [saved, setSaved] = useState(initialContent)
  const [draft, setDraft] = useState(initialContent)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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

  const handleSave = async () => {
    if (!draft.trim() || saving) return
    setSaving(true)
    setError(null)
    try {
      const supabase = getSupabaseClient()
      const { error: dbErr } = await supabase
        .from('diary_entries')
        .update({ edited_draft: draft })
        .eq('id', entryId)
      if (dbErr) throw dbErr
      setSaved(draft)
      setIsEditing(false)

      // Notion にも編集内容を反映（同期済みページは更新される。失敗しても保存には影響しない）
      if (mood != null && energy != null) {
        apiPost('/api/notion-sync', {
          entryId,
          entryDate,
          draft,
          tags,
          mood,
          energy,
        }, { retry: false }).catch((syncErr) => console.warn('Notion再同期失敗（無視）:', syncErr))
      }
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
  }

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400">日記</h2>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="text-xs text-sky-500 font-medium"
            style={{ minHeight: 0, minWidth: 0, padding: 0 }}
          >
            編集
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="animate-fade-in">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full min-h-36 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-800 dark:text-slate-200 text-base resize-none overflow-hidden focus:outline-none focus:ring-2 focus:ring-sky-400 leading-relaxed"
          />
          {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleSave}
              disabled={saving || !draft.trim()}
              className="flex-1 py-2.5 rounded-2xl bg-sky-500 text-white text-sm font-semibold disabled:opacity-50 active:scale-95 transition-transform"
            >
              {saving ? '保存中…' : '保存する'}
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-sm active:scale-95 transition-transform"
            >
              キャンセル
            </button>
          </div>
        </div>
      ) : (
        <p className="text-base text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
          {saved}
        </p>
      )}
    </div>
  )
}
