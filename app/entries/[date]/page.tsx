import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import EditableContent from '@/components/entry/EditableContent'

interface Props {
  params: Promise<{ date: string }>
}

const MOOD_EMOJI: Record<number, string> = {
  1: '😞', 2: '😕', 3: '😐', 4: '🙂', 5: '😄',
}
const MOOD_LABEL: Record<number, string> = {
  1: 'とても悪い', 2: '悪い', 3: '普通', 4: '良い', 5: 'とても良い',
}
const ENERGY_LABEL: Record<number, string> = {
  1: '枯渇', 2: '低い', 3: '普通', 4: '高い', 5: '最高',
}

export default async function EntryDetailPage({ params }: Props) {
  const { date } = await params

  // 日付フォーマット検証
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    notFound()
  }

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: entry, error } = await supabase
    .from('diary_entries')
    .select('*')
    .eq('user_id', user.id)
    .eq('entry_date', date)
    .single()

  if (error || !entry) {
    notFound()
  }

  const displayContent = entry.edited_draft ?? entry.ai_draft

  return (
    <div className="px-4 pt-6 pb-8">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/entries"
          className="w-11 h-11 rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] flex items-center justify-center text-xl text-[var(--foreground)]"
          aria-label="一覧に戻る"
        >
          ‹
        </Link>
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)]">
            {new Date(`${date}T12:00:00+09:00`).toLocaleDateString('ja-JP', {
              timeZone: 'Asia/Tokyo',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'long',
            })}
          </h1>
        </div>
      </div>

      {/* 気分・エネルギー */}
      <div className="flex gap-3 mb-6">
        <div className="flex-1 card text-center">
          <p className="text-3xl mb-1">{MOOD_EMOJI[entry.mood as number] ?? '😐'}</p>
          <p className="eyebrow">気分</p>
          <p className="text-sm font-medium text-[var(--foreground)] mt-1">
            {MOOD_LABEL[entry.mood as number] ?? '-'}
          </p>
        </div>
        <div className="flex-1 card text-center">
          <p className="text-3xl mb-1">⚡</p>
          <p className="eyebrow">エネルギー</p>
          <p className="text-sm font-medium text-[var(--foreground)] mt-1">
            {ENERGY_LABEL[entry.energy as number] ?? '-'}
          </p>
        </div>
      </div>

      {/* タグ */}
      {Array.isArray(entry.tags) && entry.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {(entry.tags as string[]).map((tag) => (
            <span
              key={tag}
              className="px-3 py-1 rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--primary)] text-xs font-medium"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* 日記本文（編集可能） */}
      {displayContent && (
        <EditableContent
          entryId={entry.id as string}
          initialContent={displayContent}
          entryDate={date}
          mood={entry.mood as number | null}
          energy={entry.energy as number | null}
          tags={Array.isArray(entry.tags) ? (entry.tags as string[]) : []}
        />
      )}

      {/* 入力内容 */}
      <div className="space-y-4">
        {entry.events && (
          <div className="card">
            <h3 className="eyebrow mb-2">今日の出来事</h3>
            <p className="text-base text-[var(--foreground)] whitespace-pre-wrap leading-relaxed">{entry.events}</p>
          </div>
        )}
        {entry.challenges && (
          <div className="card">
            <h3 className="eyebrow mb-2">課題・困ったこと</h3>
            <p className="text-base text-[var(--foreground)] whitespace-pre-wrap leading-relaxed">{entry.challenges}</p>
          </div>
        )}
        {entry.gratitude && (
          <div className="card">
            <h3 className="eyebrow mb-2">感謝できること</h3>
            <p className="text-base text-[var(--foreground)] whitespace-pre-wrap leading-relaxed">{entry.gratitude}</p>
          </div>
        )}
        {entry.freeform && (
          <div className="card">
            <h3 className="eyebrow mb-2">メモ</h3>
            <p className="text-base text-[var(--foreground)] whitespace-pre-wrap leading-relaxed">{entry.freeform}</p>
          </div>
        )}
      </div>

      {/* Notion同期状態 */}
      {entry.notion_synced_at && (
        <p className="mt-6 text-xs text-center text-[var(--muted-2)]">
          ✓ Notionに同期済み ({new Date(entry.notion_synced_at as string).toLocaleDateString('ja-JP')})
        </p>
      )}
    </div>
  )
}
