import { NextResponse } from 'next/server'
import { createReadonlyServerClient } from '@/lib/supabase-server'
import { getGroqClient, GROQ_MODELS } from '@/lib/groq'

const MIN_ENTRIES_FOR_ANALYSIS = 5

export async function POST() {
  const supabase = await createReadonlyServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // freeform には AI 内省ガイドの回答（【ふりかえり】行）が畳まれている。
  // 価値観・感情の理由を読み取る最重要素材なので必ず含める
  const { data: entries, error } = await supabase
    .from('diary_entries')
    .select('entry_date, mood, energy, events, challenges, gratitude, freeform, tags, dominant_emotion')
    .eq('user_id', user.id)
    .order('entry_date', { ascending: false })
    .limit(30)

  if (error) {
    return NextResponse.json({ error: 'データ取得に失敗しました' }, { status: 500 })
  }

  if (!entries || entries.length < MIN_ENTRIES_FOR_ANALYSIS) {
    // 正常系レスポンス: エラーではなくデータ不足の状態を返す
    return NextResponse.json({ status: 'insufficient_data' }, { status: 200 })
  }

  const totalEntries = entries.length
  const avgMood =
    Math.round(
      (entries.reduce((sum, e) => sum + (e.mood ?? 3), 0) / totalEntries) * 10
    ) / 10

  // 件数ではなく実際の日付で「直近7日間 vs その前7日間」を比較する
  // （記録頻度が低いユーザーで数週間前のデータと比較してしまうのを防ぐ）
  const jstToday = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
  const todayUtcMs = Date.parse(`${jstToday}T00:00:00Z`)
  const daysAgo = (dateStr: string) => (todayUtcMs - Date.parse(`${dateStr}T00:00:00Z`)) / 86_400_000

  const recent7 = entries.filter((e) => daysAgo(e.entry_date) < 7)
  const prev7 = entries.filter((e) => {
    const d = daysAgo(e.entry_date)
    return d >= 7 && d < 14
  })
  let moodTrend: 'improving' | 'stable' | 'declining' = 'stable'

  if (recent7.length > 0 && prev7.length > 0) {
    const recentAvg = recent7.reduce((s, e) => s + (e.mood ?? 3), 0) / recent7.length
    const prevAvg = prev7.reduce((s, e) => s + (e.mood ?? 3), 0) / prev7.length
    const diff = recentAvg - prevAvg
    if (diff > 0.3) moodTrend = 'improving'
    else if (diff < -0.3) moodTrend = 'declining'
  }

  try {
    const groq = getGroqClient()

    const summary = entries
      .slice(0, 20)
      .map((e) => {
        const parts = [`[${e.entry_date}] 気分:${e.mood}/5 エネルギー:${e.energy}/5`]
        if (e.events?.trim()) parts.push(`出来事: ${e.events.substring(0, 100)}`)
        if (e.challenges?.trim()) parts.push(`困ったこと: ${e.challenges.substring(0, 80)}`)
        if (e.gratitude?.trim()) parts.push(`感謝: ${e.gratitude.substring(0, 60)}`)
        if (e.freeform?.trim()) parts.push(`メモ・ふりかえり: ${e.freeform.substring(0, 160)}`)
        if (e.dominant_emotion?.trim()) parts.push(`感情: ${e.dominant_emotion}`)
        return parts.join(' / ')
      })
      .join('\n')

    const completion = await groq.chat.completions.create({
      model: GROQ_MODELS.quality,
      max_tokens: 1500,
      // gpt-oss は reasoning が JSON モードを壊し 400 を起こすため抑制
      reasoning_effort: 'low',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `あなたは心理的洞察を提供するコーチです。
ユーザーの日記データを分析して、パーソナリティの特徴・成長ヒント・感情トリガーを日本語で提供してください。
「メモ・ふりかえり」内の【ふりかえり】で始まる部分は、AIの問いに本人が答えた内省の記録です。
感情の理由・価値観・判断基準を読み取る最も重要な材料として重視してください。
必ず JSON 形式で返してください。`,
        },
        {
          role: 'user',
          content: `以下の日記データ（直近${entries.length}件）を分析してください：\n\n${summary}\n\n以下の JSON 形式で返してください：
{
  "personalityType": "タイプ名（例: 思慮深いリフレクター）",
  "description": "100文字程度の説明",
  "strengths": ["強み1", "強み2", "強み3"],
  "growthAreas": ["成長領域1", "成長領域2"],
  "emotionalPatterns": ["感情パターン1", "感情パターン2"],
  "coreValues": ["本人が大切にしていること1", "同2", "同3"],
  "recommendations": ["推奨アクション1", "推奨アクション2", "推奨アクション3"],
  "emotionTriggers": [
    {
      "trigger": "気分が下がりやすいシチュエーション・状況（具体的に）",
      "effect": "negative",
      "description": "どう影響するか（30字以内）"
    },
    {
      "trigger": "気分が上がりやすいシチュエーション・状況（具体的に）",
      "effect": "positive",
      "description": "どう影響するか（30字以内）"
    }
  ]
}
emotionTriggers は日記データに基づいた具体的なパターンを2〜4件挙げてください。
coreValues は日記と【ふりかえり】の回答から読み取れる「本人が大切にしているもの」（例: 丁寧に扱われること、家族との時間、達成感）を2〜4件、本人の言葉に近い表現で挙げてください。読み取れない場合は空配列にしてください。`,
        },
      ],
    })

    const text = completion.choices[0].message.content ?? ''
    const aiResult = JSON.parse(text) as {
      personalityType: string
      description: string
      strengths: string[]
      growthAreas: string[]
      emotionalPatterns: string[]
      coreValues?: string[]
      recommendations: string[]
      emotionTriggers: { trigger: string; effect: 'positive' | 'negative'; description: string }[]
    }

    return NextResponse.json({
      ...aiResult,
      coreValues: Array.isArray(aiResult.coreValues)
        ? aiResult.coreValues.filter((v): v is string => typeof v === 'string').slice(0, 4)
        : [],
      moodTrend,
      averageMood: avgMood,
      totalEntries,
    })
  } catch (err) {
    console.error('GROQ analysis error:', err)
    return NextResponse.json(buildBasicAnalysis(entries, avgMood, moodTrend, totalEntries))
  }
}

function buildBasicAnalysis(
  entries: Array<{ mood: number | null; energy: number | null; challenges: string | null }>,
  avgMood: number,
  moodTrend: 'improving' | 'stable' | 'declining',
  totalEntries: number
) {
  const hasChallenges =
    entries.filter((e) => e.challenges?.trim()).length > totalEntries / 2

  return {
    personalityType: '内省的な記録者',
    description: '毎日の出来事を丁寧に記録し、自己理解を深めている方です。',
    strengths: ['継続力', '自己観察力', '記録習慣'],
    growthAreas: hasChallenges ? ['課題解決力', 'ストレス管理'] : ['チャレンジ精神', '目標設定'],
    emotionalPatterns: [
      avgMood >= 4
        ? 'ポジティブ傾向'
        : avgMood >= 3
          ? '平静な感情状態'
          : 'ネガティブ傾向',
    ],
    coreValues: [],
    recommendations: [
      '今日の小さな成功を記録しましょう',
      '明日やりたいことを1つ決めましょう',
      '感謝できることを3つ見つけましょう',
    ],
    emotionTriggers: [],
    moodTrend,
    averageMood: avgMood,
    totalEntries,
    // AI が使えなかったことをクライアントに明示する（本物の分析と区別して表示・キャッシュ回避）
    isFallback: true,
  }
}
