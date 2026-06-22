import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

interface Entry {
  id: string
  entry_date: string
  mood: number
  energy: number
  summary: string | null
  tags: string[]
}

const MOOD_COLOR: Record<number, string> = {
  1: '#b5654a', 2: '#c5895f', 3: '#cdbf9a', 4: '#9caa7e', 5: '#6f8a5f',
}

const ENERGY_BAR: Record<number, string> = {
  1: '▪▫▫▫▫', 2: '▪▪▫▫▫', 3: '▪▪▪▫▫', 4: '▪▪▪▪▫', 5: '▪▪▪▪▪',
}

export default async function EntriesPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: entries, error } = await supabase
    .from('diary_entries')
    .select('id, entry_date, mood, energy, summary, tags')
    .eq('user_id', user.id)
    .order('entry_date', { ascending: false })
    .limit(100)

  if (error) {
    console.error('Failed to fetch entries:', error)
  }

  const safeEntries: Entry[] = (entries ?? []) as Entry[]

  // 月ごとにグループ化
  const grouped = safeEntries.reduce<Record<string, Entry[]>>((acc, entry) => {
    const month = entry.entry_date.substring(0, 7) // "YYYY-MM"
    if (!acc[month]) acc[month] = []
    acc[month].push(entry)
    return acc
  }, {})

  return (
    <div className="px-5 pt-8">
      <div className="section-head mb-6" style={{ borderBottomColor: 'var(--divider-strong)' }}>
        <div className="flex items-baseline gap-4">
          <div className="eyebrow">All entries</div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">日記一覧</h1>
        </div>
        <Link
          href="/checkin"
          className="w-10 h-10 rounded-full bg-[var(--accent)] text-[#2a2622] flex items-center justify-center text-xl font-bold"
          aria-label="新しい記録を追加"
        >
          +
        </Link>
      </div>

      {safeEntries.length === 0 ? (
        <div className="text-center py-20 text-[var(--muted)]">
          <p className="text-6xl mb-4">📖</p>
          <p className="font-medium text-lg text-[var(--foreground)]">まだ記録がありません</p>
          <p className="text-sm mt-2">チェックインして最初の日記を書こう</p>
          <Link
            href="/checkin"
            className="inline-block mt-6 px-7 py-3 rounded-[2px] bg-[var(--accent)] text-[#2a2622] font-bold"
          >
            今日の記録をする →
          </Link>
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
    </div>
  )
}
