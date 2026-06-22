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

  // 初回ユーザー: 空のホームではなくオンボーディングを表示
  if (!stats || stats.total === 0) {
    return <Onboarding />
  }

  // Asia/Tokyo 基準で今日の日付を判定
  const today = getTodayJST()
  const todayEntry = entries.find((e) => e.entry_date === today)
  const recentEntries = entries.slice(0, 5)

  // 時間帯に応じた挨拶（Asia/Tokyo）
  const hourJST = parseInt(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo', hour: 'numeric', hour12: false })
  )
  const greeting =
    hourJST < 12 ? 'おはようございます'
    : hourJST < 18 ? 'こんにちは'
    : 'こんばんは'

  const MOOD_DOT = ['', '#b5654a', '#c5895f', '#cdbf9a', '#9caa7e', '#6f8a5f']

  return (
    <div className="px-5 pt-8 pb-8 space-y-11">
      {/* ストリーク達成バナー（マイルストーン時のみ） */}
      {stats && <StreakCelebration streak={stats.streak} />}

      {/* ヘッダー */}
      <div className="flex items-start justify-between pb-6 border-b border-[var(--divider-strong)]">
        <div>
          <h1 className="text-3xl font-bold text-[var(--foreground)] tracking-tight">{greeting}</h1>
          <p className="text-[var(--muted)] text-xs tracking-[0.16em] mt-2">
            {new Date().toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
          </p>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <div className="text-right">
            <div className="eyebrow" style={{ letterSpacing: '0.24em' }}>Diary</div>
            <div className="text-xs text-[var(--muted)] mt-0.5">全{stats?.total ?? 0}件</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#2a2622] border border-[var(--accent)] flex items-center justify-center text-[#e9ddc7] text-sm">
            私
          </div>
        </div>
      </div>

      {/* チェックインCTA */}
      {!todayEntry ? (
        <Link
          href="/checkin"
          className="block w-full p-7 rounded-[3px] bg-[#2a2622] active:scale-[0.99] transition-transform"
        >
          <div className="eyebrow mb-3" style={{ color: 'var(--accent)', letterSpacing: '0.3em' }}>
            Today&apos;s check-in
          </div>
          <p className="font-bold text-xl text-[#f4efe6] tracking-tight">まだ今日の記録がありません</p>
          <p className="text-sm text-[#f4efe6]/55 mt-2 leading-relaxed">
            今日はどんな一日でしたか。ひと言だけでも残しておきましょう。
          </p>
          <span className="inline-block mt-5 bg-[var(--accent)] text-[#2a2622] text-sm font-bold px-7 py-3 rounded-[2px] tracking-wide">
            今日を記録する →
          </span>
        </Link>
      ) : (
        <Link
          href={`/entries/${today}`}
          className="block w-full p-7 rounded-[3px] bg-[#e7dcc7] border border-[#ddd0b8] active:scale-[0.99] transition-transform dark:bg-[var(--surface)] dark:border-[var(--border)]"
        >
          <div className="eyebrow mb-3" style={{ letterSpacing: '0.3em' }}>Today&apos;s check-in</div>
          <p className="font-bold text-xl text-[var(--foreground)] tracking-tight">今日の記録、完了しました</p>
          <p className="text-sm text-[var(--muted)] mt-2 leading-relaxed">
            {todayEntry.summary ?? '記録済み'}
          </p>
        </Link>
      )}

      {/* 統計カード */}
      {stats && <StatsCards stats={stats} />}

      {/* 今週の記録 */}
      <section>
        <div className="section-head">
          <div className="eyebrow">This week</div>
          <h2 className="text-base font-bold text-[var(--foreground)]">今週の記録</h2>
        </div>
        <div className="mt-6">
          <WeekStrip entries={entries} />
        </div>
      </section>

      {/* 記録ヒートマップ */}
      {entries.length > 0 && (
        <section>
          <div className="section-head">
            <div className="eyebrow">90-day trace</div>
            <h2 className="text-base font-bold text-[var(--foreground)]">記録の軌跡</h2>
          </div>
          <div className="mt-6">
            <CalendarHeatmap entries={entries} />
          </div>
        </section>
      )}

      {/* 気分チャート */}
      {entries.length > 1 && (
        <section>
          <div className="section-head">
            <div className="eyebrow">Mood &amp; energy</div>
            <h2 className="text-base font-bold text-[var(--foreground)]">気分の推移</h2>
          </div>
          <div className="mt-5">
            <MoodChart entries={entries.slice(0, 14).reverse()} />
          </div>
        </section>
      )}

      {/* 最近の記録 */}
      {recentEntries.length > 0 && (
        <section>
          <div className="section-head" style={{ borderBottomColor: 'var(--divider-strong)' }}>
            <div className="flex items-baseline gap-4">
              <div className="eyebrow">Recent</div>
              <h2 className="text-base font-bold text-[var(--foreground)]">最近の記録</h2>
            </div>
            <Link href="/entries" className="text-xs tracking-wide text-[var(--primary)]">
              すべて見る →
            </Link>
          </div>
          <div>
            {recentEntries.map((entry) => {
              const d = new Date(`${entry.entry_date}T12:00:00+09:00`)
              const dayNum = d.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', day: '2-digit' })
              const wd = d.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', weekday: 'short' })
              const mon = d.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'short' })
              return (
                <Link
                  key={entry.id}
                  href={`/entries/${entry.entry_date}`}
                  className="flex gap-5 items-start py-5 border-b border-[var(--border)] active:opacity-70 transition-opacity"
                >
                  <div className="flex-none w-12 text-right pt-0.5">
                    <div className="text-xl font-bold text-[var(--foreground)] leading-none tracking-tight">{dayNum}</div>
                    <div className="text-[11px] text-[var(--muted)] tracking-wide mt-1.5">{mon}·{wd}</div>
                  </div>
                  <div
                    className="flex-none w-2.5 h-2.5 rounded-full mt-2"
                    style={{ backgroundColor: MOOD_DOT[entry.mood] ?? '#cdbf9a' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--foreground)] leading-relaxed truncate">
                      {entry.summary ?? entry.dominant_emotion ?? '記録あり'}
                    </p>
                    {entry.tags?.length > 0 && (
                      <p className="text-xs text-[var(--muted-2)] mt-1 truncate">
                        {entry.tags.slice(0, 3).map((t) => `#${t}`).join('  ')}
                      </p>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

    </div>
  )
}

/** 初回ユーザー向けオンボーディング（記録が1件もない場合のみ表示） */
function Onboarding() {
  const steps = [
    {
      icon: '👆',
      title: '気分をタップするだけ',
      description: '必須は気分とエネルギーの2つだけ。30秒で終わります',
    },
    {
      icon: '✨',
      title: 'AIがあなたの日記を代筆',
      description: '入力したキーワードから、自然な文章の日記を自動生成',
    },
    {
      icon: '📊',
      title: '続けるほど自分がわかる',
      description: '気分の推移・感情パターンをAIが分析してくれます',
    },
  ]

  return (
    <div className="min-h-dvh flex flex-col px-6 pt-14 pb-8">
      {/* ヒーロー */}
      <div className="text-center mb-12 animate-slide-up">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#2a2622] border border-[var(--accent)] flex items-center justify-center">
          <span className="text-[#e9ddc7] text-xl tracking-wide">私</span>
        </div>
        <div className="eyebrow mb-3" style={{ letterSpacing: '0.3em' }}>Welcome</div>
        <h1 className="text-2xl font-bold text-[var(--foreground)] tracking-tight">
          ようこそ、<span className="gradient-text">Inner Mirror</span> へ
        </h1>
        <p className="text-[var(--muted)] text-sm mt-3 leading-relaxed">
          毎日30秒で、AIがあなたの日記を書きます
        </p>
      </div>

      {/* 3ステップ説明 */}
      <div className="space-y-3 mb-10">
        {steps.map((step, i) => (
          <div
            key={step.title}
            className="card flex items-start gap-4 animate-slide-up"
            style={{ animationDelay: `${0.08 * (i + 1)}s`, animationFillMode: 'backwards' }}
          >
            <span className="text-2xl flex-shrink-0 pt-0.5">{step.icon}</span>
            <div>
              <p className="font-bold text-[var(--foreground)] text-sm">{step.title}</p>
              <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed">
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="mt-auto animate-slide-up" style={{ animationDelay: '0.35s', animationFillMode: 'backwards' }}>
        <Link
          href="/checkin"
          className="block w-full py-4 text-center rounded-[2px] bg-[var(--accent)] text-[#2a2622] font-bold text-base active:scale-[0.99] transition-transform glow-sky"
        >
          最初のチェックインを始める →
        </Link>
        <p className="text-center text-xs text-[var(--muted)] mt-3">
          途中でやめてもOK。入力は自動保存されます
        </p>
      </div>
    </div>
  )
}
