import { NextRequest, NextResponse } from 'next/server'
import { createReadonlyServerClient } from '@/lib/supabase-server'
import { generateOfflineDraft } from '@/lib/offline-draft'
import { getGroqClient, GROQ_MODELS } from '@/lib/groq'
import { DRAFT_SYSTEM_PROMPT, buildDraftUserPrompt, type DraftPromptInput } from '@/lib/draft-prompt'

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
  let input: DraftPromptInput & { entryDate?: string }
  try {
    input = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // 対象日（過去日付の書き忘れ救済）。不正な形式なら無視して今日扱い
  const entryDate =
    typeof input.entryDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.entryDate)
      ? input.entryDate
      : null

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
    const result = generateOfflineDraft(input, entryDate)
    return new NextResponse(result.draft, {
      headers: { ...PLAIN_HEADERS, 'X-Draft-Fallback': '1' },
    })
  }

  // 4. GROQ API ストリーミング呼び出し
  // 本人の言葉を残す「清書」方針（lib/draft-prompt.ts）。過去の日記を文体見本に使うのはやめた
  // （見本の大半が AI の文章で、AI 調を強める原因になっていたため）
  try {
    const groq = getGroqClient()
    const stream = await groq.chat.completions.create({
      model: GROQ_MODELS.quality,
      max_tokens: 1536, // 日本語はトークン消費が多いため余裕を持たせる
      // 言い換えを減らすため低め。reasoning は推論トークンが max_tokens を食わないよう抑える
      temperature: 0.3,
      reasoning_effort: 'low',
      stream: true,
      messages: [
        { role: 'system', content: DRAFT_SYSTEM_PROMPT },
        { role: 'user', content: buildDraftUserPrompt(input, entryDate) },
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
    const result = generateOfflineDraft(input, entryDate)
    return new NextResponse(result.draft, {
      headers: { ...PLAIN_HEADERS, 'X-Draft-Fallback': '1' },
    })
  }
}
