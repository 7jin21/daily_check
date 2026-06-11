import { NextRequest, NextResponse } from 'next/server'
import { createReadonlyServerClient } from '@/lib/supabase-server'
import { generateOfflineDraft } from '@/lib/offline-draft'
import { getGroqClient, GROQ_MODELS } from '@/lib/groq'
import type { CheckinInput } from '@/stores/checkin'

const MAX_TEXT_LENGTH = 1000
const TEXT_FIELDS = ['events', 'challenges', 'gratitude', 'freeform'] as const

export async function POST(req: NextRequest) {
  // 1. セッション確認
  const supabase = await createReadonlyServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. リクエストボディ検証
  let input: CheckinInput
  try {
    input = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { mood, energy } = input
  if (
    !Number.isInteger(mood) || (mood as number) < 1 || (mood as number) > 5 ||
    !Number.isInteger(energy) || (energy as number) < 1 || (energy as number) > 5
  ) {
    return NextResponse.json({ error: 'mood, energy は 1〜5 の整数で指定してください' }, { status: 400 })
  }

  for (const field of TEXT_FIELDS) {
    const value = input[field]
    if (value != null && typeof value !== 'string') {
      return NextResponse.json({ error: `${field} は文字列で指定してください` }, { status: 400 })
    }
    if (typeof value === 'string' && value.length > MAX_TEXT_LENGTH) {
      return NextResponse.json({ error: `${field} は${MAX_TEXT_LENGTH}字以内にしてください` }, { status: 400 })
    }
  }

  // 3. GROQ API が設定されていない場合はオフラインフォールバック
  if (!process.env.GROQ_API_KEY) {
    console.warn('GROQ_API_KEY未設定 - オフラインフォールバックを使用')
    const result = generateOfflineDraft(input)
    return NextResponse.json(result)
  }

  // 4. GROQ API 呼び出し
  try {
    const groq = getGroqClient()
    const completion = await groq.chat.completions.create({
      model: GROQ_MODELS.quality,
      max_tokens: 1024,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `あなたは共感的な日記ライターです。ユーザーが提供した情報をもとに、
一人称（私は）の自然な日本語の日記を書いてください。
感情に寄り添いながら、その日の経験を豊かに表現してください。
また、タグ、サマリー、主要感情も生成してください。

必ずJSON形式で以下のフィールドを返してください:
{
  "draft": "日記本文（500文字程度）",
  "tags": ["タグ1", "タグ2", "タグ3"],
  "summary": "一行サマリー（50文字以内）",
  "dominantEmotion": "主要感情"
}`,
        },
        {
          role: 'user',
          content: buildPrompt(input),
        },
      ],
    })

    const text = completion.choices[0].message.content ?? ''
    const parsed = JSON.parse(text) as {
      draft?: string
      tags?: string[]
      summary?: string
      dominantEmotion?: string
    }

    if (!parsed.draft?.trim()) {
      throw new Error('draft field missing in AI response')
    }

    return NextResponse.json({
      draft: parsed.draft,
      tags: Array.isArray(parsed.tags) ? parsed.tags.filter((t) => typeof t === 'string') : [],
      summary: parsed.summary ?? '',
      dominantEmotion: parsed.dominantEmotion ?? '',
    })
  } catch (err) {
    console.error('GROQ draft generation error:', err)
    // フォールバック
    const result = generateOfflineDraft(input)
    return NextResponse.json({ ...result, _fallback: true })
  }
}

function buildPrompt(input: CheckinInput): string {
  const parts: string[] = []

  parts.push(`気分スコア: ${input.mood}/5`)
  parts.push(`エネルギースコア: ${input.energy}/5`)

  if (input.events?.trim()) {
    parts.push(`今日の出来事:\n${input.events}`)
  }
  if (input.challenges?.trim()) {
    parts.push(`困ったこと・課題:\n${input.challenges}`)
  }
  if (input.gratitude?.trim()) {
    parts.push(`感謝できること:\n${input.gratitude}`)
  }
  if (input.freeform?.trim()) {
    parts.push(`その他メモ:\n${input.freeform}`)
  }

  return parts.join('\n\n')
}
