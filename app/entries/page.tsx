import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import MonthCalendar from '@/components/entries/MonthCalendar'
import { formatJSTDate, todayJST } from '@/lib/jst'
import { energyLabel, moodLabel } from '@/lib/constants'
import { EnergyGlyph, MoodGlyph } from '@/components/ui/StateGlyphs'
import { ArrowLeftIcon, ArrowRightIcon, ChevronRightIcon, MirrorMark, PlusIcon, SearchIcon } from '@/components/ui/icons'

interface Entry {
  id: string
  entry_date: string
  mood: number
  energy: number
  summary: string | null
  tags: string[]
}

interface Props {
  searchParams: Promise<{ q?: string; page?: string; view?: string; month?: string; tag?: string }>
}

/** "YYYY-MM" を delta ヶ月分ずらす */
function shiftMonth(monthStr: string, delta: number): string {
  const [y, m] = monthStr.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const PAGE_SIZE = 60

// PostgREST の or() はカンマ・括弧が構文になるため取り除き、
// ilike のワイルドカードもエスケープする
function sanitizeQuery(raw: string): string {
  return raw.replace(/[,()]/g, ' ').replace(/[%_\\]/g, '\\$&').trim().slice(0, 50)
}

function ViewToggle({ view }: { view: 'list' | 'calendar' }) {
  const item = (active: boolean) =>
    `px-5 py-2 rounded-full text-sm font-bold font-ui transition-colors ${
      active ? 'bg-[var(--btn-bg)] text-[var(--btn-fg)]' : 'text-[var(--muted)]'
    }`
  return (
    <nav className="flex gap-1 p-1 mb-6 rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] w-fit" aria-label="表示の切り替え">
      <Link href="/entries" className={item(view === 'list')} aria-current={view === 'list' ? 'page' : undefined}>
        リスト
      </Link>
      <Link href="/entries?view=calendar" className={item(view === 'calendar')} aria-current={view === 'calendar' ? 'page' : undefined}>
        カレンダー
      </Link>
    </nav>
  )
}

/** 見出しの帯（一覧・カレンダー共通） */
function EntriesHeader() {
  return (
    <div className="section-head mb-5" style={{ borderBottomColor: 'var(--divider-strong)' }}>
      <div className="flex items-baseline gap-4">
        <div className="eyebrow">All entries</div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">日記一覧</h1>
      </div>
      <Link href="/checkin" className="icon-btn" style={{ background: 'var(--btn-bg)', color: 'var(--btn-fg)', borderColor: 'transparent' }} aria-label="今日の記録をする">
        <PlusIcon size={20} />
      </Link>
    </div>
  )
}

export default async function EntriesPage({ searchParams }: Props) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const params = await searchParams
  const view = params.view === 'calendar' ? 'calendar' : 'list'
  const today = todayJST()
  const currentMonth = today.slice(0, 7)

  if (view === 'calendar') {
    const monthParam = /^\d{4}-\d{2}$/.test(params.month ?? '') ? (params.month as string) : currentMonth
    const [y, m] = monthParam.split('-').map(Number)
    const firstDay = `${monthParam}-01`
    const lastDay = `${monthParam}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`

    const { data: monthEntries, error } = await supabase
      .from('diary_entries')
      .select('entry_date, mood, summary')
      .eq('user_id', user.id)
      .gte('entry_date', firstDay)
      .lte('entry_date', lastDay)

    if (error) {
      console.error('Failed to fetch month entries:', error)
    }

    return (
      <div className="px-5 pt-8 pb-8">
        <EntriesHeader />

        <ViewToggle view={view} />

        <MonthCalendar
          year={y}
          month={m}
          entries={(monthEntries ?? []) as { entry_date: string; mood: number; summary: string | null }[]}
          todayJST={today}
          prevHref={`/entries?view=calendar&month=${shiftMonth(monthParam, -1)}`}
          nextHref={monthParam < currentMonth ? `/entries?view=calendar&month=${shiftMonth(monthParam, 1)}` : null}
          todayHref={monthParam !== currentMonth ? `/entries?view=calendar&month=${currentMonth}` : null}
        />
      </div>
    )
  }

  const rawQuery = (params.q ?? '').trim().slice(0, 50)
  const q = sanitizeQuery(rawQuery)
  // タグで絞り込む（同じテーマの記録を時系列でたどる）
  // 配列リテラルの区切り文字は取り除く（PostgREST の cs フィルタを壊さないように）
  const tag = (params.tag ?? '').replace(/[{},"\\]/g, '').trim().slice(0, 30)
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)
  const offset = (page - 1) * PAGE_SIZE

  let query = supabase
    .from('diary_entries')
    .select('id, entry_date, mood, energy, summary, tags')
    .eq('user_id', user.id)

  if (tag) {
    query = query.contains('tags', [tag])
  }

  if (q) {
    const pattern = `%${q}%`
    query = query.or(
      `summary.ilike.${pattern},edited_draft.ilike.${pattern},ai_draft.ilike.${pattern},events.ilike.${pattern},freeform.ilike.${pattern}`
    )
  }

  // PAGE_SIZE+1 件取得して「次のページがあるか」を判定する
  const { data: entries, error } = await query
    .order('entry_date', { ascending: false })
    .range(offset, offset + PAGE_SIZE)

  if (error) {
    console.error('Failed to fetch entries:', error)
  }

  const fetched: Entry[] = (entries ?? []) as Entry[]
  const hasMore = fetched.length > PAGE_SIZE
  const safeEntries = fetched.slice(0, PAGE_SIZE)

  // 月ごとにグループ化
  const grouped = safeEntries.reduce<Record<string, Entry[]>>((acc, entry) => {
    const month = entry.entry_date.substring(0, 7) // "YYYY-MM"
    if (!acc[month]) acc[month] = []
    acc[month].push(entry)
    return acc
  }, {})

  const pageLink = (p: number) =>
    `/entries?${new URLSearchParams({ ...(rawQuery ? { q: rawQuery } : {}), ...(tag ? { tag } : {}), page: String(p) })}`

  return (
    <div className="px-5 pt-8 pb-8">
      <EntriesHeader />

      <ViewToggle view="list" />

      {/* キーワード検索（GET フォーム） */}
      <form method="GET" action="/entries" className="mb-6 flex gap-2" role="search">
        {tag && <input type="hidden" name="tag" value={tag} />}
        <input
          type="search"
          name="q"
          defaultValue={rawQuery}
          placeholder="キーワードで検索（本文・出来事・メモ）"
          aria-label="キーワード"
          className="flex-1 min-w-0 px-4 py-2.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] placeholder:text-[var(--muted-2)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
        />
        <button type="submit" className="icon-btn" aria-label="検索">
          <SearchIcon size={20} />
        </button>
      </form>

      {tag && (
        <div className="mb-5 flex items-center justify-between gap-3 p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)]">
          <div>
            <p className="text-base font-bold text-[var(--primary)]">#{tag}</p>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              このタグがついた記録 {safeEntries.length}
              {hasMore ? '+' : ''}件（新しい順）
            </p>
          </div>
          <Link href="/entries" className="text-xs text-[var(--primary)] underline underline-offset-2">
            解除
          </Link>
        </div>
      )}

      {rawQuery && (
        <p className="mb-4 text-sm text-[var(--muted)]">
          「{rawQuery}」の検索結果 {safeEntries.length}{hasMore ? '+' : ''}件
          <Link href="/entries" className="ml-3 text-[var(--primary)] underline underline-offset-2 text-xs">
            クリア
          </Link>
        </p>
      )}

      {safeEntries.length === 0 ? (
        <div className="text-center py-20 text-[var(--muted)]">
          <MirrorMark size={48} className="empty-mark" />
          {rawQuery || tag ? (
            <>
              <p className="font-medium text-lg text-[var(--foreground)]">見つかりませんでした</p>
              <p className="text-sm mt-2">別のキーワードで試してみてください</p>
            </>
          ) : (
            <>
              <p className="font-medium text-lg text-[var(--foreground)]">まだ記録がありません</p>
              <p className="text-sm mt-2">チェックインして最初の日記を書こう</p>
              <Link href="/checkin" className="btn btn-primary mt-6">
                今日の記録をする
                <ArrowRightIcon size={18} className="btn-arrow" />
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-9">
          {Object.entries(grouped).map(([month, monthEntries]) => (
            <div key={month}>
              <h2 className="eyebrow mb-4">
                {formatJSTDate(`${month}-01`, { year: 'numeric', month: 'long' })}
              </h2>
              <div>
                {monthEntries.map((entry) => (
                  <Link
                    key={entry.id}
                    href={`/entries/${entry.entry_date}`}
                    className="flex items-start gap-4 py-5 border-b border-[var(--border)] active:opacity-70 transition-opacity"
                  >
                    {/* 気分（月）とエネルギー（水位）。一覧でも、チェックインで選んだときと同じ形 */}
                    <span className="flex-none flex flex-col items-center gap-1 pt-0.5">
                      <MoodGlyph mood={entry.mood} size={22} label={`気分 ${moodLabel(entry.mood) ?? '—'}`} />
                      <EnergyGlyph energy={entry.energy} size={16} label={`エネルギー ${energyLabel(entry.energy) ?? '—'}`} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-[var(--foreground)]">
                          {formatJSTDate(entry.entry_date, { month: 'numeric', day: 'numeric', weekday: 'short' })}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--muted)] truncate">
                        {entry.summary || '気分だけの記録'}
                      </p>
                      {entry.tags.length > 0 && (
                        <div className="flex gap-2 mt-1.5 flex-wrap">
                          {entry.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="text-xs text-[var(--primary)]">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <ChevronRightIcon size={18} className="flex-none self-center text-[var(--faint)]" />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ページング */}
      {(page > 1 || hasMore) && (
        <div className="flex items-center justify-between mt-8">
          {page > 1 ? (
            <Link href={pageLink(page - 1)} className="gap-1.5 text-sm text-[var(--primary)] font-bold font-ui">
              <ArrowLeftIcon size={16} />
              新しい記録
            </Link>
          ) : <span />}
          <span className="text-xs text-[var(--muted-2)]">ページ {page}</span>
          {hasMore ? (
            <Link href={pageLink(page + 1)} className="gap-1.5 text-sm text-[var(--primary)] font-bold font-ui">
              古い記録
              <ArrowRightIcon size={16} />
            </Link>
          ) : <span />}
        </div>
      )}
    </div>
  )
}
