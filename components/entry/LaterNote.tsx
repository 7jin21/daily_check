'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase'
import { appendLaterNote } from '@/lib/freeform'
import { todayJST } from '@/lib/jst'

// 過去の日記に「今の一言」を添える。当時の本文には手を触れず、freeform の末尾に日付つきで足す。
const MAX = 300

export default function LaterNote({ entryId, autoOpen = false }: { entryId: string; autoOpen?: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(autoOpen)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!open) return
    ref.current?.focus({ preventScroll: true })
    ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [open])

  const save = async () => {
    if (!text.trim() || saving) return
    setSaving(true)
    setError(null)
    try {
      const supabase = getSupabaseClient()
      // 直前の内容を読み直してから足す（ほかの画面での変更を消さない）
      const { data, error: readError } = await supabase.from('diary_entries').select('freeform').eq('id', entryId).single()
      if (readError) throw readError
      const { error: writeError } = await supabase
        .from('diary_entries')
        .update({ freeform: appendLaterNote(data.freeform as string | null, todayJST(), text) })
        .eq('id', entryId)
      if (writeError) throw writeError
      setText('')
      setOpen(false)
      router.refresh()
    } catch (err) {
      console.error('今の一言の保存に失敗:', err)
      setError('保存できませんでした。時間をおいて再試行してください。')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full mt-4 py-4 px-5 rounded-2xl border border-dashed border-[var(--border)] text-left flex-col !items-start gap-1"
      >
        <span className="text-sm font-bold text-[var(--foreground)]">＋ 今の一言を添える</span>
        <span className="text-xs text-[var(--muted)]">当時の日記はそのままに、今の見方を書き足せます</span>
      </button>
    )
  }

  return (
    <div className="card mt-4 animate-fade-in">
      <h3 className="eyebrow mb-1">いまのあなたから</h3>
      <p className="text-xs text-[var(--muted)] mb-3">この日の自分に、今はどう思う？</p>
      <textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX))}
        rows={3}
        placeholder="例：あのとき悩んでいたこと、今は笑い話になった"
        className="w-full p-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] text-base resize-none focus:outline-none focus:ring-2 focus:ring-[var(--primary)] leading-relaxed"
      />
      {error && (
        <p className="mt-1.5 text-xs" style={{ color: '#9c4a2f' }}>
          {error}
        </p>
      )}
      <div className="flex gap-2 mt-3">
        <button
          onClick={save}
          disabled={saving || !text.trim()}
          className="flex-1 py-2.5 rounded-full bg-[var(--accent)] text-[#f7f4ea] text-sm font-bold disabled:opacity-50 active:scale-95 transition-transform"
        >
          {saving ? '保存中…' : '添える'}
        </button>
        <button
          onClick={() => {
            setOpen(false)
            setText('')
          }}
          className="px-4 py-2.5 rounded-full border border-[var(--border)] text-[var(--muted)] text-sm active:scale-95 transition-transform"
        >
          やめる
        </button>
      </div>
    </div>
  )
}
