import { NextRequest, NextResponse } from 'next/server'
import { createReadonlyServerClient } from '@/lib/supabase-server'
import { generateOfflineDraft } from '@/lib/offline-draft'
import { getGroqClient, GROQ_MODELS } from '@/lib/groq'
import type { CheckinInput } from '@/stores/checkin'

// 日記本文を text/plain でストリーミング返却する。
// タグ・サマリー等のメタ情報は本文確定後に /api/draft-meta で取得する（クライアント側）。
// オフラインフォールバック時は X-Draft-Fallback: 1 ヘッダーを付けて全文を一括返却。

const MAX_TEXT_LENGTH = 1000
const TEXT_FIELDS = ['events', 'challenges', 'gratitude', 'freeform'] as const

const PLAIN_HEADERS = { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' }

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
    return new NextResponse(result.draft, {
      headers: { ...PLAIN_HEADERS, 'X-Draft-Fallback': '1' },
    })
  }

  // 4. 文体学習: 直近の日記2件を文体サンプルとしてプロンプトに含める
  let styleSamples = ''
  try {
    const { data: recent } = await supabase
      .from('diary_entries')
      .select('edited_draft, ai_draft')
      .eq('user_id', user.id)
      .order('entry_date', { ascending: false })
      .limit(2)

    const samples = (recent ?? [])
      .map((r) => (r.edited_draft || r.ai_draft || '').trim().slice(0, 300))
      .filter(Boolean)

    if (samples.length > 0) {
      styleSamples = `\n\n【参考: 過去の日記の文体サンプル】\n（口調・文体・リズムだけ真似てください。内容や出来事は絶対に流用しないこと）\n\n${samples.join('\n---\n')}`
    }
  } catch {
    // 文体サンプル取得失敗は無視（通常生成にフォールバック）
  }

  // 5. GROQ API ストリーミング呼び出し
  try {
    const groq = getGroqClient()
    const stream = await groq.chat.completions.create({
      model: GROQ_MODELS.quality,
      max_tokens: 1536, // 日本語はトークン消費が多いため余裕を持たせる
      stream: true,
      messages: [
        {
          role: 'system',
          content: `あなたは共感的な日記ライターです。ユーザーが提供した情報をもとに、
一人称（私は）の自然な日本語の日記を書いてください。
感情に寄り添いながら、その日の経験を豊かに表現してください。

ルール:
- 500文字程度
- 日記の本文のみを出力する（前置き・見出し・記号・JSONは一切付けない）
- 過去の日記サンプルがあれば、その口調と文体を真似る（内容は使わない）`,
        },
        {
          role: 'user',
          content: buildPrompt(input) + styleSamples,
        },
      ],
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content ?? ''
            if (delta) controller.enqueue(encoder.encode(delta))
          }
        } catch (err) {
          console.error('GROQ stream error:', err)
        }
        controller.close()
      },
    })

    return new NextResponse(readable, { headers: PLAIN_HEADERS })
  } catch (err) {
    console.error('GROQ draft generation error:', err)
    // フォールバック
    const result = generateOfflineDraft(input)
    return new NextResponse(result.draft, {
      headers: { ...PLAIN_HEADERS, 'X-Draft-Fallback': '1' },
    })
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
