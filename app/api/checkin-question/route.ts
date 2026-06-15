import { NextRequest, NextResponse } from 'next/server'
import { createReadonlyServerClient } from '@/lib/supabase-server'
import { getGroqClient, GROQ_MODELS } from '@/lib/groq'
import type { CheckinInput } from '@/stores/checkin'

// チェックイン入力を読み、本人の内省を1つだけ促す質問（3〜4択）を返す。
// 目的: 後から AI が「感情の理由・価値観・判断基準」を読み取れる材料を1つ足すこと。
//
// 重要な設計方針:
// - 聞く価値がある時だけ聞く。十分書けている / ほぼ空 なら skip。
// - 何があっても日記生成をブロックしない。失敗・未設定・曖昧な出力は全て skip 扱い。

export const runtime = 'nodejs'

const SKIP = { skip: true as const }

// 入力テキストの合計が短すぎる/長すぎる場合の早期判定用
const MIN_TEXT_FOR_QUESTION = 4 // これ未満なら材料が無く質問しない
const NONE_OPTION = 'どれも近くない'

function collectText(input: CheckinInput): string {
  return [input.events, input.challenges, input.gratitude, input.freeform]
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter(Boolean)
    .join('\n')
}

function buildUserPrompt(input: CheckinInput): string {
  const parts: string[] = []
  if (input.mood != null) parts.push(`気分スコア: ${input.mood}/5`)
  if (input.energy != null) parts.push(`エネルギースコア: ${input.energy}/5`)
  if (input.events?.trim()) parts.push(`今日の出来事:\n${input.events.trim()}`)
  if (input.challenges?.trim()) parts.push(`困ったこと・課題:\n${input.challenges.trim()}`)
  if (input.gratitude?.trim()) parts.push(`感謝できること:\n${input.gratitude.trim()}`)
  if (input.freeform?.trim()) parts.push(`自由記述:\n${input.freeform.trim()}`)
  return parts.join('\n\n')
}

const SYSTEM_PROMPT = `あなたはユーザーの日記入力を読み、本人の内省を「1つだけ」やさしく促すアシスタントです。
目的は、後からその人の「感情の理由・価値観・判断基準」が分かる材料を1つ足すこと。

入力を読み、次のうち最も欠けているものを1つだけ選んで質問してください:
- 感情はあるが「なぜそう感じたか」が書かれていない
- 出来事はあるが「どう感じたか」が書かれていない
- 迷い/選択はあるが「何を優先したか」が書かれていない
- 感謝はあるが「その何が自分にとって嬉しかったか」が書かれていない

ルール:
- 質問は1つだけ。短く、決めつけず、「近いものがあれば選んでください」という姿勢。
- 選択肢は3〜4個。本人が「あ、これかも」と気づける具体的な候補にする。評価や決めつけ（「あなたは〜なのでは」）はしない。
- すでに感情・理由・価値観まで十分書けていて質問が不要なら skip:true。
- 入力がほぼ空で深掘りする材料が無いなら skip:true。
- 「どれも近くない」という選択肢は自分で含めない（システム側で付与する）。

必ず次のいずれかの JSON だけを返す:
{"skip": false, "question": "短い問い", "options": ["候補1", "候補2", "候補3"]}
または
{"skip": true}`

export async function POST(req: NextRequest) {
  // 1. セッション確認（未ログインは弾く。質問が無くても日記は作れるので skip では返さない）
  const supabase = await createReadonlyServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. GROQ 未設定 → 質問なし（ブロックしない）
  if (!process.env.GROQ_API_KEY) return NextResponse.json(SKIP)

  // 3. 入力取得
  let input: CheckinInput
  try {
    input = await req.json()
  } catch {
    return NextResponse.json(SKIP)
  }

  // 4. 材料が無ければ AI を呼ばずに skip
  if (collectText(input).length < MIN_TEXT_FOR_QUESTION) {
    return NextResponse.json(SKIP)
  }

  // 5. 質問生成（選択肢の質を重視するため quality モデル / JSON モード）
  try {
    const groq = getGroqClient()
    const completion = await groq.chat.completions.create({
      model: GROQ_MODELS.quality,
      max_tokens: 1000,
      temperature: 0,
      // gpt-oss は reasoning が JSON モードを壊し 400(json_validate_failed) を
      // 起こすことがある。reasoning を抑え、トークンに余裕を持たせると安定する（実測 0/10 失敗）。
      reasoning_effort: 'low',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(input) },
      ],
    })

    const text = completion.choices[0]?.message?.content ?? ''
    const parsed = JSON.parse(text) as {
      skip?: unknown
      question?: unknown
      options?: unknown
    }

    if (parsed.skip === true) return NextResponse.json(SKIP)

    const question = typeof parsed.question === 'string' ? parsed.question.trim() : ''
    const options = Array.isArray(parsed.options)
      ? parsed.options
          .filter((o): o is string => typeof o === 'string' && o.trim().length > 0)
          .map((o) => o.trim())
          .slice(0, 4)
      : []

    // 出力が不十分なら skip（ブロックしない）
    if (!question || options.length < 2) return NextResponse.json(SKIP)

    // 「どれも近くない」を末尾に必ず付与
    if (!options.includes(NONE_OPTION)) options.push(NONE_OPTION)

    return NextResponse.json({ skip: false, question, options })
  } catch (err) {
    console.error('GROQ checkin-question error:', err)
    return NextResponse.json(SKIP)
  }
}
