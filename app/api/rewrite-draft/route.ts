import { NextRequest, NextResponse } from 'next/server'
import { createReadonlyServerClient } from '@/lib/supabase-server'
import { getGroqClient, GROQ_MODELS } from '@/lib/groq'

const INSTRUCTIONS = {
  emotional: '感情をより豊かに、心の動きを細やかに描写して書き直してください。',
  shorter: '同じ内容を保ちつつ、半分程度の長さに簡潔にまとめてください。',
  positive: 'ポジティブな側面や学びに焦点を当てて書き直してください。困難な部分も希望のある視点で表現してください。',
  formal: 'より丁寧でフォーマルな文体に書き直してください。',
} as const

type Instruction = keyof typeof INSTRUCTIONS

export async function POST(req: NextRequest) {
  const supabase = await createReadonlyServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { draft: string; instruction: Instruction }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { draft, instruction } = body
  if (!draft?.trim() || !instruction || !(instruction in INSTRUCTIONS)) {
    return NextResponse.json({ error: 'draft と instruction は必須です' }, { status: 400 })
  }
  if (draft.length > 2000) {
    return NextResponse.json({ error: '文章が長すぎます（2000字以内）' }, { status: 400 })
  }

  try {
    const groq = getGroqClient()
    const completion = await groq.chat.completions.create({
      // 日本語の文体変換は品質重視モデルを使う
      model: GROQ_MODELS.quality,
      max_tokens: 1024,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `あなたは日本語の文章編集者です。ユーザーの日記を指示に従って書き直します。
元の文章の事実・日付・固有名詞は変えず、文体・表現のみを変えてください。
必ず JSON 形式で {"draft": "書き直した文章"} を返してください。`,
        },
        {
          role: 'user',
          content: `【指示】${INSTRUCTIONS[instruction]}\n\n【元の文章】\n${draft}`,
        },
      ],
    })

    const text = completion.choices[0].message.content ?? ''
    const parsed = JSON.parse(text) as { draft?: string }
    if (!parsed.draft) throw new Error('draft field missing')
    return NextResponse.json({ draft: parsed.draft })
  } catch (err) {
    console.error('GROQ rewrite error:', err)
    return NextResponse.json({ error: 'AI書き直しに失敗しました' }, { status: 500 })
  }
}
