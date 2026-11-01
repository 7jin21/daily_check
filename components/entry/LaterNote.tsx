'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase'
import { appendLaterNote } from '@/lib/freeform'
import { todayJST } from '@/lib/jst'
import { PlusIcon } from '@/components/ui/icons'

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
        <span className="inline-flex items-center gap-1.5 text-sm font-bold font-ui text-[var(--foreground)]">
          <PlusIcon size={16} />
          今の一言を添える
        </span>
        <span className="text-xs font-ui text-[var(--muted)]">当時の日記はそのままに、今の見方を書き足せます</span>
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
        aria-label="今の一言"
        className="w-full p-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] font-mincho resize-none focus:outline-none focus:ring-2 focus:ring-[var(--primary)] leading-loose"
      />
      {error && (
        <p className="mt-1.5 text-xs text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2 mt-3">
        <button type="button" onClick={save} disabled={saving || !text.trim()} className="btn btn-primary btn-sm flex-1">
          {saving ? '保存しています…' : '添える'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setText('')
          }}
          className="btn btn-secondary btn-sm"
        >
          やめる
        </button>
      </div>
    </div>
  )
}
