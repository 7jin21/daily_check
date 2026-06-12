import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import StatsCards from '@/components/home/StatsCards'
import MoodChart from '@/components/home/MoodChart'
import CalendarHeatmap from '@/components/home/CalendarHeatmap'
import StreakCelebration from '@/components/home/StreakCelebration'
import WeekStrip from '@/components/home/WeekStrip'
import Link from 'next/link'

interface DiaryEntry {
  id: string
  entry_date: string
  mood: number
  energy: number
  summary: string | null
  dominant_emotion: string | null
  tags: string[]
}

/** Asia/Tokyo の今日の日付を YYYY-MM-DD で返す */
function getTodayJST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
}

/** YYYY-MM-DD 文字列から n 日前の日付文字列を返す */
function subtractDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const target = new Date(y, m - 1, d - n)
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`
}

async function getHomeData(userId: string) {
  const supabase = await createServerSupabaseClient()
  const todayJST = getTodayJST()

  // 直近365日分を日付範囲で取得
  // （件数 limit だと毎日記録するユーザーでヒートマップ・ストリークにデータ欠けが出る）
  const [entriesResult, countResult] = await Promise.all([
    supabase
      .from('diary_entries')
      .select('id, entry_date, mood, energy, summary, dominant_emotion, tags')
      .eq('user_id', userId)
      .gte('entry_date', subtractDays(todayJST, 365))
      .order('entry_date', { ascending: false }),
    supabase
      .from('diary_entries')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
  ])

  const { data: entries, error } = entriesResult

  if (error) {
    console.error('Failed to fetch entries:', error)
    return { entries: [] as DiaryEntry[], stats: null }
  }

  const safeEntries: DiaryEntry[] = (entries ?? []) as DiaryEntry[]

  // 統計計算（総記録数は全期間、平均気分は直近365日）
  const total = countResult.count ?? safeEntries.length
  const avgMood =
    safeEntries.length > 0
      ? Math.round((safeEntries.reduce((sum, e) => sum + (e.mood ?? 0), 0) / safeEntries.length) * 10) / 10
      : 0

  // 連続記録日数（Asia/Tokyo 基準）
  // 今日の記録がなくても昨日から連続していれば streak を維持する
  const todayHasEntry = safeEntries[0]?.entry_date === todayJST
  let streak = 0
  for (let i = 0; i < safeEntries.length; i++) {
    const daysAgo = todayHasEntry ? i : i + 1
    const expectedDate = subtractDays(todayJST, daysAgo)
    if (safeEntries[i]?.entry_date === expectedDate) {
      streak++
    } else {
      break
    }
  }

  return {
    entries: safeEntries,
    stats: { total, avgMood, streak },
  }
}

export default async function HomePage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { entries, stats } = await getHomeData(user.id)

  // Asia/Tokyo 基準で今日の日付を判定
  const today = getTodayJST()
  const todayEntry = entries.find((e) => e.entry_date === today)
  const recentEntries = entries.slice(0, 5)

  // 時間帯に応じた挨拶（Asia/Tokyo）
  const hourJST = parseInt(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo', hour: 'numeric', hour12: false })
  )
  const greeting =
    hourJST < 12 ? 'おはようございます 🌅'
    : hourJST < 18 ? 'こんにちは ☀️'
    : 'こんばんは 🌙'

  return (
    <div className="px-4 pt-6 pb-6 space-y-6">
      {/* ストリーク達成バナー（マイルストーン時のみ） */}
      {stats && <StreakCelebration streak={stats.streak} />}

      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{greeting}</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
            {new Date().toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
          </p>
        </div>
        <div className="w-10 h-10 rounded-full animated-gradient flex items-center justify-center text-lg shadow-md shadow-sky-500/20">
          🪞
        </div>
      </div>

      {/* チェックインCTA */}
      {!todayEntry ? (
        <Link
          href="/checkin"
          className="block w-full p-5 rounded-2xl animated-gradient text-white shadow-xl shadow-sky-500/25 active:scale-95 transition-transform overflow-hidden relative"
        >
          {/* 背景の装飾 */}
          <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/10 blur-xl pointer-events-none" />
          <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full bg-white/10 blur-lg pointer-events-none" />
          <div className="flex items-center justify-between relative">
            <div>
              <p className="font-bold text-xl tracking-tight">今日のチェックイン</p>
              <p className="text-white/70 text-sm mt-0.5">まだ記録していません</p>
            </div>
            <span className="text-5xl animate-float">✍️</span>
          </div>
        </Link>
      ) : (
        <Link
          href={`/entries/${today}`}
          className="block w-full p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 active:scale-95 transition-transform"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-lg text-emerald-700 dark:text-emerald-400">今日の記録完了！</p>
              <p className="text-emerald-600 dark:text-emerald-500 text-sm mt-0.5">
                {todayEntry.summary ?? '記録済み'}
              </p>
            </div>
            <span className="text-4xl">✅</span>
          </div>
        </Link>
      )}

      {/* 統計カード */}
      {stats && <StatsCards stats={stats} />}

      {/* 今週の記録 */}
      <div className="card">
        <h2 className="font-semibold text-slate-700 dark:text-slate-300 mb-4">今週の記録</h2>
        <WeekStrip entries={entries} />
      </div>

      {/* 記録ヒートマップ */}
      {entries.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-slate-700 dark:text-slate-300 mb-3">記録の軌跡</h2>
          <CalendarHeatmap entries={entries} />
        </div>
      )}

      {/* 気分チャート */}
      {entries.length > 1 && (
        <div className="card">
          <h2 className="font-semibold text-slate-700 dark:text-slate-300 mb-3">気分の推移</h2>
          <MoodChart entries={entries.slice(0, 14).reverse()} />
        </div>
      )}

      {/* 最近の記録 */}
      {recentEntries.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-700 dark:text-slate-300">最近の記録</h2>
            <Link href="/entries" className="text-sky-500 text-sm font-medium">
              すべて見る
            </Link>
          </div>
          <div className="space-y-2">
            {recentEntries.map((entry) => (
              <Link
                key={entry.id}
                href={`/entries/${entry.entry_date}`}
                className="block card hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {entry.mood === 5 ? '😄' : entry.mood === 4 ? '🙂' : entry.mood === 3 ? '😐' : entry.mood === 2 ? '😕' : '😞'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {new Date(`${entry.entry_date}T12:00:00+09:00`).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'short', day: 'numeric', weekday: 'short' })}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                      {entry.summary ?? entry.dominant_emotion ?? '記録あり'}
                    </p>
                  </div>
                  <span className="text-slate-300 dark:text-slate-600">›</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* エントリがない場合 */}
      {entries.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <p className="text-5xl mb-4">📓</p>
          <p className="font-medium">まだ記録がありません</p>
          <p className="text-sm mt-1">最初のチェックインをしてみましょう</p>
        </div>
      )}
    </div>
  )
}
