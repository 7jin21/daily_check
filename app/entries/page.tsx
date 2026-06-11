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

const MOOD_EMOJI: Record<number, string> = {
  1: '😞', 2: '😕', 3: '😐', 4: '🙂', 5: '😄',
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
    <div className="px-4 pt-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">日記一覧</h1>
        <Link
          href="/checkin"
          className="w-10 h-10 rounded-full bg-gradient-to-r from-sky-400 to-violet-500 text-white flex items-center justify-center text-xl font-bold"
          aria-label="新しい記録を追加"
        >
          +
        </Link>
      </div>

      {safeEntries.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <p className="text-6xl mb-4">📖</p>
          <p className="font-medium text-lg">まだ記録がありません</p>
          <p className="text-sm mt-2">チェックインして最初の日記を書こう</p>
          <Link
            href="/checkin"
            className="inline-block mt-6 px-6 py-3 rounded-2xl bg-sky-500 text-white font-semibold"
          >
            今日の記録をする
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([month, monthEntries]) => (
            <div key={month}>
              <h2 className="text-sm font-semibold text-slate-400 dark:text-slate-500 mb-3 uppercase tracking-wide">
                {new Date(`${month}-01T12:00:00+09:00`).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long' })}
              </h2>
              <div className="space-y-2">
                {monthEntries.map((entry) => (
                  <Link
                    key={entry.id}
                    href={`/entries/${entry.entry_date}`}
                    className="block card hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-center w-10">
                        <span className="text-2xl">{MOOD_EMOJI[entry.mood] ?? '😐'}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {new Date(`${entry.entry_date}T12:00:00+09:00`).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', weekday: 'short' })}
                          </span>
                          <span className="text-xs text-sky-400 font-mono tracking-tighter">
                            {ENERGY_BAR[entry.energy] ?? ''}
                          </span>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                          {entry.summary ?? '記録あり'}
                        </p>
                        {entry.tags.length > 0 && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {entry.tags.slice(0, 3).map((tag) => (
                              <span key={tag} className="text-xs text-sky-500 dark:text-sky-400">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="text-slate-300 dark:text-slate-600 text-lg">›</span>
                    </div>
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
