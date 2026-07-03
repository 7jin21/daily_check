import { NextRequest, NextResponse } from 'next/server'
import { createReadonlyServerClient } from '@/lib/supabase-server'
import { getGroqClient, GROQ_MODELS } from '@/lib/groq'

// 「AI に聞いてみる」: 直近の日記データを文脈に、ユーザーの質問へ1回だけ答える。
// 例:「今週なんでこんなに疲れてたんだろう」「最近気分がいい日の共通点は？」

const MAX_QUESTION_LENGTH = 200

export async function POST(req: NextRequest) {
  const supabase = await createReadonlyServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'AIへの質問は現在利用できません' }, { status: 503 })
  }

  let question = ''
  try {
    const body = (await req.json()) as { question?: unknown }
    if (typeof body.question === 'string') question = body.question.trim()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!question) {
    return NextResponse.json({ error: '質問を入力してください' }, { status: 400 })
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return NextResponse.json({ error: `質問は${MAX_QUESTION_LENGTH}字以内にしてください` }, { status: 400 })
  }

  const { data: entries, error } = await supabase
    .from('diary_entries')
    .select('entry_date, mood, energy, events, challenges, gratitude, freeform, dominant_emotion')
    .eq('user_id', user.id)
    .order('entry_date', { ascending: false })
    .limit(30)

  if (error) return NextResponse.json({ error: 'データ取得に失敗しました' }, { status: 500 })
  if (!entries || entries.length === 0) {
    return NextResponse.json({ answer: 'まだ日記の記録がないため、お答えできる材料がありません。まずは今日のチェックインから始めてみましょう。' })
  }

  const summary = entries
    .map((e) => {
      const parts = [`[${e.entry_date}] 気分:${e.mood}/5 エネルギー:${e.energy}/5`]
      if (e.events?.trim()) parts.push(`出来事: ${e.events.substring(0, 100)}`)
      if (e.challenges?.trim()) parts.push(`困ったこと: ${e.challenges.substring(0, 80)}`)
      if (e.gratitude?.trim()) parts.push(`感謝: ${e.gratitude.substring(0, 60)}`)
      if (e.freeform?.trim()) parts.push(`メモ・ふりかえり: ${e.freeform.substring(0, 120)}`)
      if (e.dominant_emotion?.trim()) parts.push(`感情: ${e.dominant_emotion}`)
      return parts.join(' / ')
    })
    .join('\n')

  try {
    const groq = getGroqClient()
    const completion = await groq.chat.completions.create({
      model: GROQ_MODELS.quality,
      max_tokens: 700,
      messages: [
        {
          role: 'system',
          content: `あなたはユーザーの日記をよく知る、共感的なパートナーです。
以下のルールで、ユーザーの質問に日本語で答えてください:
- 必ず日記データに基づいて答える。日付や記録内容を具体的に引用してよい
- データから断定できないことは「記録からは〜のように見える」と推測であることを明示する
- 決めつけ・説教・医療的な診断はしない。温かく、簡潔に（300字以内）
- 【ふりかえり】で始まる部分は本人の内省の記録なので、感情の理由・価値観として重視する
- 回答本文のみを出力する（前置き・見出しは不要）`,
        },
        {
          role: 'user',
          content: `直近の日記データ（${entries.length}件）:\n\n${summary}\n\n質問: ${question}`,
        },
      ],
    })

    const answer = (completion.choices[0]?.message?.content ?? '').trim()
    if (!answer) throw new Error('empty answer')
    return NextResponse.json({ answer })
  } catch (err) {
    console.error('GROQ ask error:', err)
    return NextResponse.json({ error: '回答の生成に失敗しました。時間をおいて再試行してください。' }, { status: 500 })
  }
}
