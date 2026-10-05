import { notFound } from 'next/navigation'
import { buildHomeModel, subtractDays, toJSTDate, type HomeEntry } from '@/lib/home-model'
import HomeView, { OnboardingView } from '@/components/home/HomeView'

// 開発専用: モックデータでホームを表示する（デザイン確認用。本番では 404）
// ?h=0-23 時刻 / ?date=YYYY-MM-DD 日付 / ?state=recorded|moodonly|empty|new

const SUMMARIES = [
  '朝の散歩で金木犀の香りがして、少し季節が進んだ気がした',
  '企画書を半分まで。夜はラーメンで締めた',
  '部長に資料を褒められてちょっと嬉しい一日',
  '母と買い物。新しい靴を買った',
  '雨で一日家にいた。本を一冊読み終えた',
  '仕様変更で午後は作り直し。前提を確認してほしかった',
  '同期とカレー。午後は眠くて集中できず',
  'ジム30分、読書、洗濯。早めに寝る',
  '久しぶりに友人と電話。笑いすぎてお腹が痛い',
  '何もしない日。それでいいと思えた',
]
const TAGS = ['仕事', '散歩', '読書', '家族', '友人', '睡眠', '運動', '料理', '雨', '休日']

function mockEntries(today: string, includeToday: boolean): HomeEntry[] {
  let seed = 42
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
  const out: HomeEntry[] = []
  let mood = 3.6
  for (let i = includeToday ? 0 : 1; i < 400; i++) {
    const date = subtractDays(today, i)
    mood = Math.min(5, Math.max(1, mood + (rand() - 0.5) * 1.6))
    // 直近は連続記録、それ以前はときどき抜ける
    if (i > 12 && rand() < 0.28) continue
    if (i === 1 && !includeToday) continue // 昨日の書き忘れ導線を確認できるように
    const m = Math.round(mood)
    out.push({
      id: `mock-${i}`,
      entry_date: date,
      mood: m,
      energy: Math.min(5, Math.max(1, Math.round(mood + (rand() - 0.5) * 2))),
      summary: SUMMARIES[Math.floor(rand() * SUMMARIES.length)],
      dominant_emotion: ['満足', '平静', '喜び', '疲れ', '不安'][Math.floor(rand() * 5)],
      tags: [TAGS[Math.floor(rand() * TAGS.length)], TAGS[Math.floor(rand() * TAGS.length)]].filter(
        (t, k, a) => a.indexOf(t) === k
      ),
    })
  }
  return out
}

export default async function DevHomePreview({
  searchParams,
}: {
  searchParams: Promise<{ h?: string; state?: string; date?: string }>
}) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { h, state, date } = await searchParams

  const now = new Date()
  if (h !== undefined || date) {
    const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : toJSTDate(now)
    const hour = h !== undefined ? Math.max(0, Math.min(23, Number(h))) : 21
    now.setTime(Date.parse(`${day}T${String(hour).padStart(2, '0')}:20:00+09:00`))
  }
  const today = toJSTDate(now)

  if (state === 'new') {
    return <OnboardingView model={buildHomeModel([], 0, now)} now={now} />
  }
  const entries = mockEntries(today, state === 'recorded' || state === 'moodonly')
  if (state === 'moodonly' && entries[0]?.entry_date === today) {
    entries[0] = { ...entries[0], summary: null, dominant_emotion: null, tags: [] }
  }
  const cutoff = subtractDays(today, 365)
  const within = entries.filter((e) => e.entry_date >= cutoff)
  return <HomeView model={buildHomeModel(within, entries.length, now)} now={now} />
}
