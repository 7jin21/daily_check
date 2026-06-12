import { NextRequest, NextResponse } from 'next/server'
import { createReadonlyServerClient } from '@/lib/supabase-server'
import { getGroqClient, GROQ_MODELS } from '@/lib/groq'

// ストリーミング生成された日記本文から、タグ・サマリー・主要感情を抽出する。
// 高速モデルを使うため体感遅延はほぼない。

export async function POST(req: NextRequest) {
  const supabase = await createReadonlyServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { draft?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const draft = body.draft
  if (typeof draft !== 'string' || !draft.trim()) {
    return NextResponse.json({ error: 'draft は必須です' }, { status: 400 })
  }
  if (draft.length > 3000) {
    return NextResponse.json({ error: 'draft が長すぎます' }, { status: 400 })
  }

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ tags: [], summary: '', dominantEmotion: '' })
  }

  try {
    const groq = getGroqClient()
    const completion = await groq.chat.completions.create({
      model: GROQ_MODELS.fast,
      max_tokens: 256,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `日記の本文を分析して、必ず以下の JSON 形式で返してください:
{
  "tags": ["タグ1", "タグ2", "タグ3"],
  "summary": "一行サマリー（50文字以内）",
  "dominantEmotion": "主要感情（一語。例: 喜び、満足、不安、疲労）"
}`,
        },
        {
          role: 'user',
          content: draft,
        },
      ],
    })

    const text = completion.choices[0].message.content ?? ''
    const parsed = JSON.parse(text) as {
      tags?: unknown
      summary?: unknown
      dominantEmotion?: unknown
    }

    // AI レスポンスの形状検証（欠けていてもクラッシュさせない）
    return NextResponse.json({
      tags: Array.isArray(parsed.tags)
        ? parsed.tags.filter((t): t is string => typeof t === 'string').slice(0, 5)
        : [],
      summary: typeof parsed.summary === 'string' ? parsed.summary.slice(0, 60) : '',
      dominantEmotion: typeof parsed.dominantEmotion === 'string' ? parsed.dominantEmotion.slice(0, 20) : '',
    })
  } catch (err) {
    console.error('GROQ draft-meta error:', err)
    return NextResponse.json({ tags: [], summary: '', dominantEmotion: '' })
  }
}
