import { NextRequest, NextResponse } from 'next/server'
import { createReadonlyServerClient } from '@/lib/supabase-server'
import { getGroqClient, GROQ_MODELS } from '@/lib/groq'

export interface WeeklyReport {
  narrative: string
  highlight: string
  challenge: string
  nextFocus: string
  weekMood: string
  focusReview?: string
  entryCount: number
  avgMood: number
  isFallback?: boolean
}

interface WeeklyEntry {
  entry_date: string
  mood: number | null
  energy: number | null
  events: string | null
  challenges: string | null
  gratitude: string | null
  freeform: string | null
  dominant_emotion: string | null
}

export async function POST(req: NextRequest) {
  const supabase = await createReadonlyServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 前回レポートの「来週のフォーカス」（あれば今週のふり返りに使う）
  let previousFocus = ''
  try {
    const body = (await req.json()) as { previousFocus?: unknown }
    if (typeof body.previousFocus === 'string') previousFocus = body.previousFocus.trim().slice(0, 100)
  } catch {
    // body なしでも動く
  }

  const jstToday = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
  const [y, m, d] = jstToday.split('-').map(Number)
  const from = new Date(y, m - 1, d - 6).toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })

  const { data: entries, error } = await supabase
    .from('diary_entries')
    .select('entry_date, mood, energy, events, challenges, gratitude, freeform, dominant_emotion')
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

  const summary = (entries as WeeklyEntry[])
    .map((e) => {
      const parts = [`[${e.entry_date}] 気分:${e.mood}/5 エネルギー:${e.energy}/5`]
      if (e.events?.trim()) parts.push(`出来事: ${e.events.substring(0, 120)}`)
      if (e.challenges?.trim()) parts.push(`困ったこと: ${e.challenges.substring(0, 80)}`)
      if (e.gratitude?.trim()) parts.push(`感謝: ${e.gratitude.substring(0, 80)}`)
      if (e.freeform?.trim()) parts.push(`メモ・ふりかえり: ${e.freeform.substring(0, 120)}`)
      if (e.dominant_emotion?.trim()) parts.push(`感情: ${e.dominant_emotion}`)
      return parts.join(' / ')
    })
    .join('\n')

  try {
    const groq = getGroqClient()

    const focusInstruction = previousFocus
      ? `\n\n先週のレポートでは「来週のフォーカス」として「${previousFocus}」を提案しました。今週の記録を踏まえて、それがどうだったかを "focusReview"（60字以内・責めない表現で）として必ず含めてください。`
      : ''
    const focusField = previousFocus ? `,\n  "focusReview": "先週のフォーカスがどうだったか（60字以内）"` : ''

    const completion = await groq.chat.completions.create({
      model: GROQ_MODELS.quality,
      max_tokens: 1024,
      // gpt-oss は reasoning が JSON モードを壊し 400 を起こすため抑制
      reasoning_effort: 'low',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `あなたはユーザーの自己理解をサポートするライフコーチです。
週間日記データをもとに、温かく共感的なトーンで振り返りレポートを日本語で生成してください。
「メモ・ふりかえり」内の【ふりかえり】部分は本人の内省の記録なので、感情の理由・価値観として重視してください。
必ず JSON 形式で返してください。`,
        },
        {
          role: 'user',
          content: `今週（${from}〜${jstToday}）の日記データ（${entries.length}件）です：\n\n${summary}\n\n平均気分: ${avgMood}/5${focusInstruction}\n\n以下の JSON 形式で振り返りレポートを生成してください：
{
  "narrative": "今週全体を振り返るナラティブ文章（150〜200字）",
  "highlight": "今週最も印象的だったポジティブな出来事や感情（50字以内）",
  "challenge": "今週乗り越えた、または直面した困難（50字以内）",
  "nextFocus": "来週意識するとよいこと（50字以内）",
  "weekMood": "今週の全体的な雰囲気を表す一言（例：充実、穏やか、波乱など）"${focusField}
}`,
        },
      ],
    })

    const text = completion.choices[0].message.content ?? ''
    const parsed = JSON.parse(text) as Omit<WeeklyReport, 'entryCount' | 'avgMood'>
    return NextResponse.json({ ...parsed, entryCount: entries.length, avgMood })
  } catch (err) {
    console.error('GROQ weekly report error:', err)
    // AI が使えなくても統計ベースの簡易レポートを返す（analyze と同じ思想。
    // クライアントは isFallback を見て注記表示・キャッシュ回避する）
    return NextResponse.json(buildBasicWeeklyReport(entries as WeeklyEntry[], avgMood))
  }
}

function buildBasicWeeklyReport(entries: WeeklyEntry[], avgMood: number): WeeklyReport {
  const moods = entries.map((e) => e.mood ?? 3)
  const best = entries[moods.indexOf(Math.max(...moods))]
  const gratitudeEntry = entries.find((e) => e.gratitude?.trim())
  const challengeEntry = entries.find((e) => e.challenges?.trim())

  const weekMood = avgMood >= 4 ? '好調' : avgMood >= 3 ? '穏やか' : '踏ん張り'

  return {
    narrative: `今週は${entries.length}件の記録を残しました。平均気分は${avgMood}/5で、全体として「${weekMood}」の一週間でした。記録を続けていること自体が、自分を大切にする時間になっています。`,
    highlight: gratitudeEntry?.gratitude?.trim().slice(0, 50) || `${best?.entry_date ?? '今週'}の気分が最も良い日でした`,
    challenge: challengeEntry?.challenges?.trim().slice(0, 50) || '大きな困難の記録はありませんでした',
    nextFocus: '今週と同じペースで、まず記録を続けること',
    weekMood,
    entryCount: entries.length,
    avgMood,
    isFallback: true,
  }
}
