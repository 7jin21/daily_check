import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { buildHomeModel, subtractDays, toJSTDate, type HomeEntry } from '@/lib/home-model'
import HomeView, { OnboardingView } from '@/components/home/HomeView'

export default async function HomePage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const now = new Date()
  const todayJST = toJSTDate(now)

  // 直近365日分を日付範囲で取得
  // （件数 limit だと毎日記録するユーザーでヒートマップ・ストリークにデータ欠けが出る）
  const [entriesResult, countResult] = await Promise.all([
    supabase
      .from('diary_entries')
      .select('id, entry_date, mood, energy, summary, dominant_emotion, tags')
      .eq('user_id', user.id)
      .gte('entry_date', subtractDays(todayJST, 365))
      .order('entry_date', { ascending: false }),
    supabase.from('diary_entries').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
  ])

  if (entriesResult.error) {
    console.error('Failed to fetch entries:', entriesResult.error)
  }

  const entries = (entriesResult.data ?? []) as HomeEntry[]
  // 総記録数は全期間
  const total = countResult.count ?? entries.length
  const model = buildHomeModel(entries, total, now)

  // 初回ユーザー: 空のホームではなくオンボーディングを表示
  if (total === 0) {
    return <OnboardingView model={model} now={now} />
  }

  return <HomeView model={model} now={now} />
}
