'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase'

// 日記エントリーの削除（RLS により自分の行しか消せない）。
// Notion に同期済みのページはこのアプリからは消さない（明示的にユーザーへ伝える）。

interface Props {
  entryId: string
  notionSynced: boolean
}

export default function DeleteEntryButton({ entryId, notionSynced }: Props) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    const message = notionSynced
      ? 'この日記を削除しますか？この操作は取り消せません。\n（Notion に同期済みのページは残ります。必要なら Notion 側で削除してください）'
      : 'この日記を削除しますか？この操作は取り消せません。'
    if (!window.confirm(message)) return

    setIsDeleting(true)
    setError(null)
    try {
      const supabase = getSupabaseClient()
      const { error: dbError } = await supabase
        .from('diary_entries')
        .delete()
        .eq('id', entryId)
      if (dbError) throw dbError
      router.push('/entries')
      router.refresh()
    } catch (err) {
      console.error('削除エラー:', err)
      setError('削除に失敗しました。時間をおいて再試行してください。')
      setIsDeleting(false)
    }
  }

  return (
    <div className="mt-10 text-center">
      <button
        onClick={handleDelete}
        disabled={isDeleting}
        className="text-xs text-[#9c4a2f] dark:text-[#d39177] underline underline-offset-2 disabled:opacity-40"
      >
        {isDeleting ? '削除中…' : 'この日記を削除する'}
      </button>
      {error && <p className="mt-2 text-xs" style={{ color: '#9c4a2f' }}>{error}</p>}
    </div>
  )
}
