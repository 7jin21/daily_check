import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import MonthCalendar from '@/components/entries/MonthCalendar'

interface Entry {
  id: string
  entry_date: string
  mood: number
  energy: number
  summary: string | null
  tags: string[]
}

interface Props {
  searchParams: Promise<{ q?: string; page?: string; view?: string; month?: string }>
}

/** Asia/Tokyo の今日の日付を YYYY-MM-DD で返す */
function getTodayJST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
}

/** "YYYY-MM" を delta ヶ月分ずらす */
function shiftMonth(monthStr: string, delta: number): string {
  const [y, m] = monthStr.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const PAGE_SIZE = 60

const MOOD_COLOR: Record<number, string> = {
  1: '#b5654a', 2: '#c5895f', 3: '#cdbf9a', 4: '#9caa7e', 5: '#6f8a5f',
}

const ENERGY_BAR: Record<number, string> = {
  1: '▪▫▫▫▫', 2: '▪▪▫▫▫', 3: '▪▪▪▫▫', 4: '▪▪▪▪▫', 5: '▪▪▪▪▪',
}

// PostgREST の or() はカンマ・括弧が構文になるため取り除き、
// ilike のワイルドカードもエスケープする
function sanitizeQuery(raw: string): string {
  return raw.replace(/[,()]/g, ' ').replace(/[%_\\]/g, '\\$&').trim().slice(0, 50)
}

function ViewToggle({ view }: { view: 'list' | 'calendar' }) {
  return (
    <div className="flex gap-1 p-1 mb-6 rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] w-fit">
      <Link
        href="/entries"
        className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${
          view === 'list' ? 'bg-[var(--accent)] text-[#f7f4ea]' : 'text-[var(--muted)]'
        }`}
      >
        リスト
      </Link>
      <Link
        href="/entries?view=calendar"
        className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${
          view === 'calendar' ? 'bg-[var(--accent)] text-[#f7f4ea]' : 'text-[var(--muted)]'
        }`}
      >
        カレンダー
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
  const todayJST = getTodayJST()
  const currentMonth = todayJST.slice(0, 7)

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
        <div className="section-head mb-5" style={{ borderBottomColor: 'var(--divider-strong)' }}>
          <div className="flex items-baseline gap-4">
            <div className="eyebrow">All entries</div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">日記一覧</h1>
          </div>
          <Link
            href="/checkin"
            className="w-10 h-10 rounded-full bg-[var(--accent)] text-[#f7f4ea] flex items-center justify-center text-xl font-bold"
            aria-label="新しい記録を追加"
          >
            +
          </Link>
        </div>

        <ViewToggle view={view} />

        <MonthCalendar
          year={y}
          month={m}
          entries={(monthEntries ?? []) as { entry_date: string; mood: number; summary: string | null }[]}
          todayJST={todayJST}
          prevHref={`/entries?view=calendar&month=${shiftMonth(monthParam, -1)}`}
          nextHref={monthParam < currentMonth ? `/entries?view=calendar&month=${shiftMonth(monthParam, 1)}` : null}
          todayHref={monthParam !== currentMonth ? `/entries?view=calendar&month=${currentMonth}` : null}
        />
      </div>
    )
  }

  const rawQuery = (params.q ?? '').trim().slice(0, 50)
  const q = sanitizeQuery(rawQuery)
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)
  const offset = (page - 1) * PAGE_SIZE

  let query = supabase
    .from('diary_entries')
    .select('id, entry_date, mood, energy, summary, tags')
    .eq('user_id', user.id)

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
    `/entries?${new URLSearchParams({ ...(rawQuery ? { q: rawQuery } : {}), page: String(p) })}`

  return (
    <div className="px-5 pt-8 pb-8">
      <div className="section-head mb-5" style={{ borderBottomColor: 'var(--divider-strong)' }}>
        <div className="flex items-baseline gap-4">
          <div className="eyebrow">All entries</div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">日記一覧</h1>
        </div>
        <Link
          href="/checkin"
          className="w-10 h-10 rounded-full bg-[var(--accent)] text-[#f7f4ea] flex items-center justify-center text-xl font-bold"
          aria-label="新しい記録を追加"
        >
          +
        </Link>
      </div>

      <ViewToggle view="list" />

      {/* キーワード検索（GET フォーム） */}
      <form method="GET" action="/entries" className="mb-6 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={rawQuery}
          placeholder="キーワードで検索（本文・出来事・メモ）"
          className="flex-1 px-4 py-2.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
        />
        <button
          type="submit"
          className="px-4 py-2.5 rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] text-sm font-medium active:scale-95 transition-transform"
        >
          検索
        </button>
      </form>

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
          <p className="text-6xl mb-4">📖</p>
          {rawQuery ? (
            <>
              <p className="font-medium text-lg text-[var(--foreground)]">見つかりませんでした</p>
              <p className="text-sm mt-2">別のキーワードで試してみてください</p>
            </>
          ) : (
            <>
              <p className="font-medium text-lg text-[var(--foreground)]">まだ記録がありません</p>
              <p className="text-sm mt-2">チェックインして最初の日記を書こう</p>
              <Link
                href="/checkin"
                className="inline-block mt-6 px-7 py-3 rounded-full bg-[var(--accent)] text-[#f7f4ea] font-bold"
              >
                今日の記録をする →
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-9">
          {Object.entries(grouped).map(([month, monthEntries]) => (
            <div key={month}>
              <h2 className="eyebrow mb-4">
                {new Date(`${month}-01T12:00:00+09:00`).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long' })}
              </h2>
              <div>
                {monthEntries.map((entry) => (
                  <Link
                    key={entry.id}
                    href={`/entries/${entry.entry_date}`}
                    className="flex items-start gap-4 py-5 border-b border-[var(--border)] active:opacity-70 transition-opacity"
                  >
                    <div
                      className="flex-none w-2.5 h-2.5 rounded-full mt-2"
                      style={{ backgroundColor: MOOD_COLOR[entry.mood] ?? '#cdbf9a' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-[var(--foreground)]">
                          {new Date(`${entry.entry_date}T12:00:00+09:00`).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', weekday: 'short' })}
                        </span>
                        <span className="text-xs text-[var(--muted-2)] font-mono tracking-tighter">
                          {ENERGY_BAR[entry.energy] ?? ''}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--muted)] truncate">
                        {entry.summary ?? '記録あり'}
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
                    <span className="text-[var(--muted-2)] text-lg">›</span>
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
            <Link href={pageLink(page - 1)} className="text-sm text-[var(--primary)] font-medium">
              ← 新しい記録
            </Link>
          ) : <span />}
          <span className="text-xs text-[var(--muted-2)]">ページ {page}</span>
          {hasMore ? (
            <Link href={pageLink(page + 1)} className="text-sm text-[var(--primary)] font-medium">
              古い記録 →
            </Link>
          ) : <span />}
        </div>
      )}
    </div>
  )
}
