import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import EditableContent from '@/components/entry/EditableContent'
import DeleteEntryButton from '@/components/entry/DeleteEntryButton'
import ShareEntryButton from '@/components/entry/ShareEntryButton'
import LaterNote from '@/components/entry/LaterNote'
import { parseFreeform } from '@/lib/freeform'
import { toJSTDate } from '@/lib/home-model'

interface Props {
  params: Promise<{ date: string }>
  // write=1: 言葉を書き足す（気分だけの記録から）／ now=1: 今の一言を添える（フラッシュバックから）
  searchParams: Promise<{ write?: string; now?: string }>
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

export default async function EntryDetailPage({ params, searchParams }: Props) {
  const { date } = await params
  const { write, now } = await searchParams

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

  // || を使う: edited_draft が空文字のときも ai_draft にフォールバックさせる
  const displayContent: string = entry.edited_draft || entry.ai_draft || ''
  const today = toJSTDate()
  // 自由メモ・内省の答え・あとから添えた一言を分けて表示する
  const ff = parseFreeform(entry.freeform as string | null)

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
          {/* タグから、同じテーマの記録を時系列でたどれる */}
          {(entry.tags as string[]).map((tag) => (
            <Link
              key={tag}
              href={`/entries?tag=${encodeURIComponent(tag)}`}
              className="px-3 py-1 rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--primary)] text-xs font-medium"
              style={{ minHeight: 32 }}
            >
              #{tag}
            </Link>
          ))}
        </div>
      )}

      {/* 日記本文（編集可能。気分だけの記録なら、ここから言葉を書き足せる） */}
      <EditableContent
        entryId={entry.id as string}
        initialContent={displayContent}
        entryDate={date}
        mood={entry.mood as number | null}
        energy={entry.energy as number | null}
        tags={Array.isArray(entry.tags) ? (entry.tags as string[]) : []}
        autoEdit={write === '1' && !displayContent}
        needsMeta={!entry.summary}
        isToday={date === today}
      />

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
        {ff.memo && (
          <div className="card">
            <h3 className="eyebrow mb-2">メモ</h3>
            <p className="text-base text-[var(--foreground)] whitespace-pre-wrap leading-relaxed">{ff.memo}</p>
          </div>
        )}
        {ff.reflections.map((r, i) => (
          <div key={`r${i}`} className="card">
            <h3 className="eyebrow mb-2">ふりかえり</h3>
            <p className="text-sm text-[var(--muted)] leading-relaxed">{r.question}</p>
            {r.answer && (
              <p className="mt-1.5 text-base text-[var(--foreground)] whitespace-pre-wrap leading-relaxed">{r.answer}</p>
            )}
          </div>
        ))}
        {ff.laterNotes.map((n, i) => (
          <div key={`n${i}`} className="card" style={{ borderStyle: 'dashed' }}>
            <h3 className="eyebrow mb-2">あとから・{n.date.split('-').join('.')}</h3>
            <p className="text-base text-[var(--foreground)] whitespace-pre-wrap leading-relaxed">{n.text}</p>
          </div>
        ))}
      </div>

      {/* 過去の日記に「今の一言」を添える（当時の本文はそのまま） */}
      {date < today && <LaterNote entryId={entry.id as string} autoOpen={now === '1'} />}

      {/* シェア */}
      <div className="mt-6 flex gap-3">
        <ShareEntryButton
          date={date}
          mood={entry.mood as number | null}
          summary={entry.summary as string | null}
          dominantEmotion={entry.dominant_emotion as string | null}
          tags={Array.isArray(entry.tags) ? (entry.tags as string[]) : []}
        />
      </div>

      {/* Notion同期状態 */}
      {entry.notion_synced_at && (
        <p className="mt-6 text-xs text-center text-[var(--muted-2)]">
          ✓ Notionに同期済み ({new Date(entry.notion_synced_at as string).toLocaleDateString('ja-JP')})
        </p>
      )}

      {/* 削除（データの所有権はユーザーにある） */}
      <DeleteEntryButton entryId={entry.id as string} notionSynced={!!entry.notion_page_id} />
    </div>
  )
}
