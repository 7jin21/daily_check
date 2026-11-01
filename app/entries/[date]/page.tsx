import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import EditableContent from '@/components/entry/EditableContent'
import DeleteEntryButton from '@/components/entry/DeleteEntryButton'
import ShareEntryButton from '@/components/entry/ShareEntryButton'
import LaterNote from '@/components/entry/LaterNote'
import { parseFreeform } from '@/lib/freeform'
import { APP_TIME_ZONE, formatJSTDate, todayJST } from '@/lib/jst'
import { ENERGY, energyLabel, moodLabel } from '@/lib/constants'
import { EnergyGlyph, MoodGlyph } from '@/components/ui/StateGlyphs'
import { CheckIcon, ChevronLeftIcon } from '@/components/ui/icons'

interface Props {
  params: Promise<{ date: string }>
  // write=1: 言葉を書き足す（気分だけの記録から）／ now=1: 今の一言を添える（フラッシュバックから）
  searchParams: Promise<{ write?: string; now?: string }>
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
  const today = todayJST()
  // 自由メモ・内省の答え・あとから添えた一言を分けて表示する
  const ff = parseFreeform(entry.freeform as string | null)

  return (
    <div className="px-4 pt-6 pb-8">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/entries" className="icon-btn" aria-label="一覧に戻る">
          <ChevronLeftIcon />
        </Link>
        <div>
          <h1 className="font-mincho text-xl font-semibold tracking-wide text-[var(--foreground)]">
            {formatJSTDate(date, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'long',
            })}
          </h1>
        </div>
      </div>

      {/* 気分・エネルギー */}
      {/* 気分（月の満ち欠け）とエネルギー（水位）。チェックインで選んだときと同じ形 */}
      <div className="flex gap-3 mb-6">
        <div className="flex-1 card flex flex-col items-center gap-1.5" style={{ padding: '18px 12px' }}>
          <MoodGlyph mood={entry.mood as number | null} size={46} />
          <p className="eyebrow mt-1">気分</p>
          <p className="font-mincho text-base font-semibold text-[var(--foreground)]">
            {moodLabel(entry.mood as number | null) ?? '—'}
          </p>
        </div>
        <div className="flex-1 card flex flex-col items-center gap-1.5" style={{ padding: '18px 12px' }}>
          <EnergyGlyph energy={entry.energy as number | null} size={46} />
          <p className="eyebrow mt-1">エネルギー</p>
          <p className="font-mincho text-base font-semibold text-[var(--foreground)]">
            {energyLabel(entry.energy as number | null) ?? '—'}
          </p>
          <p className="text-[0.6875rem] font-ui text-[var(--muted)]">
            {ENERGY.find((e) => e.value === entry.energy)?.description ?? ''}
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
              className="tag-pill"
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
            <p className="font-mincho text-base text-[var(--foreground)] whitespace-pre-wrap leading-loose prose-ja">{entry.events}</p>
          </div>
        )}
        {entry.challenges && (
          <div className="card">
            <h3 className="eyebrow mb-2">課題・困ったこと</h3>
            <p className="font-mincho text-base text-[var(--foreground)] whitespace-pre-wrap leading-loose prose-ja">{entry.challenges}</p>
          </div>
        )}
        {entry.gratitude && (
          <div className="card">
            <h3 className="eyebrow mb-2">感謝できること</h3>
            <p className="font-mincho text-base text-[var(--foreground)] whitespace-pre-wrap leading-loose prose-ja">{entry.gratitude}</p>
          </div>
        )}
        {ff.memo && (
          <div className="card">
            <h3 className="eyebrow mb-2">メモ</h3>
            <p className="font-mincho text-base text-[var(--foreground)] whitespace-pre-wrap leading-loose prose-ja">{ff.memo}</p>
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
            <p className="font-mincho text-base text-[var(--foreground)] whitespace-pre-wrap leading-loose prose-ja">{n.text}</p>
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
        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs font-ui text-[var(--muted-2)]">
          <CheckIcon size={14} />
          Notionに同期済み ({new Date(entry.notion_synced_at as string).toLocaleDateString('ja-JP', { timeZone: APP_TIME_ZONE })})
        </p>
      )}

      {/* 削除（データの所有権はユーザーにある） */}
      <DeleteEntryButton entryId={entry.id as string} notionSynced={!!entry.notion_page_id} />
    </div>
  )
}
