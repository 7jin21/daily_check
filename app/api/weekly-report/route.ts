import { NextResponse } from 'next/server'
import { createReadonlyServerClient } from '@/lib/supabase-server'
import { getGroqClient, GROQ_MODELS } from '@/lib/groq'

export interface WeeklyReport {
  narrative: string
  highlight: string
  challenge: string
  nextFocus: string
  weekMood: string
  entryCount: number
  avgMood: number
}

export async function POST() {
  const supabase = await createReadonlyServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const jstToday = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
  const [y, m, d] = jstToday.split('-').map(Number)
  const from = new Date(y, m - 1, d - 6).toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })

  const { data: entries, error } = await supabase
    .from('diary_entries')
    .select('entry_date, mood, energy, events, challenges, gratitude, dominant_emotion')
    .eq('user_id', user.id)
    .gte('entry_date', from)
    .order('entry_date', { ascending: true })

  if (error) return NextResponse.json({ error: 'データ取得に失敗しました' }, { status: 500 })
  if (!entries || entries.length === 0) {
    // 正常系レスポンス: エラーではなくデータなしの状態を返す
    return NextResponse.json({ status: 'no_data' }, { status: 200 })
  }

  const avgMood =
    Math.round(
      (entries.reduce((s, e) => s + (e.mood ?? 3), 0) / entries.length) * 10
    ) / 10

  const summary = entries
    .map((e) => {
      const parts = [`[${e.entry_date}] 気分:${e.mood}/5 エネルギー:${e.energy}/5`]
      if (e.events?.trim()) parts.push(`出来事: ${e.events.substring(0, 120)}`)
      if (e.challenges?.trim()) parts.push(`困ったこと: ${e.challenges.substring(0, 80)}`)
      if (e.gratitude?.trim()) parts.push(`感謝: ${e.gratitude.substring(0, 80)}`)
      if (e.dominant_emotion?.trim()) parts.push(`感情: ${e.dominant_emotion}`)
      return parts.join(' / ')
    })
    .join('\n')

  try {
    const groq = getGroqClient()
    const completion = await groq.chat.completions.create({
      model: GROQ_MODELS.quality,
      max_tokens: 1024,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `あなたはユーザーの自己理解をサポートするライフコーチです。
週間日記データをもとに、温かく共感的なトーンで振り返りレポートを日本語で生成してください。
必ず JSON 形式で返してください。`,
        },
        {
          role: 'user',
          content: `今週（${from}〜${jstToday}）の日記データ（${entries.length}件）です：\n\n${summary}\n\n平均気分: ${avgMood}/5\n\n以下の JSON 形式で振り返りレポートを生成してください：
{
  "narrative": "今週全体を振り返るナラティブ文章（150〜200字）",
  "highlight": "今週最も印象的だったポジティブな出来事や感情（50字以内）",
  "challenge": "今週乗り越えた、または直面した困難（50字以内）",
  "nextFocus": "来週意識するとよいこと（50字以内）",
  "weekMood": "今週の全体的な雰囲気を表す一言（例：充実、穏やか、波乱など）"
}`,
        },
      ],
    })

    const text = completion.choices[0].message.content ?? ''
    const parsed = JSON.parse(text) as Omit<WeeklyReport, 'entryCount' | 'avgMood'>
    return NextResponse.json({ ...parsed, entryCount: entries.length, avgMood })
  } catch (err) {
    console.error('GROQ weekly report error:', err)
    return NextResponse.json({ error: 'レポート生成に失敗しました' }, { status: 500 })
  }
}
