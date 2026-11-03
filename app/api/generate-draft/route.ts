import { NextRequest, NextResponse } from 'next/server'
import { createReadonlyServerClient } from '@/lib/supabase-server'
import { generateOfflineDraft } from '@/lib/offline-draft'
import { getGroqClient, GROQ_MODELS } from '@/lib/groq'
import {
  DRAFT_CUT_MARK,
  DRAFT_GENERATION,
  DRAFT_SYSTEM_PROMPT,
  buildDraftUserPrompt,
  draftMaxTokens,
  type DraftPromptInput,
} from '@/lib/draft-prompt'
import type { DraftStreamFrame } from '@/lib/draft-stream'
import { isISODate } from '@/lib/jst'
import { NOTE_FIELDS } from '@/lib/draft-compose'

// 新クライアントには NDJSON で本文と完了通知を分け、通信が終わっただけでは完成品にしない。
// Accept を指定しない旧クライアントには従来の text/plain + DRAFT_CUT_MARK を返す。
// タグ・サマリー等のメタ情報は本文確定後に /api/draft-meta で取得する（クライアント側）。
// オフラインフォールバック時は X-Draft-Fallback: 1 ヘッダーを付けて全文を一括返却。
// 清書が途中で止まった（出力の上限・途中の失敗）ときは、本文の末尾に DRAFT_CUT_MARK を付ける。

const MAX_TEXT_LENGTH = 1000

const PLAIN_HEADERS = { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' }

export async function POST(req: NextRequest) {
  const framed = req.headers.get('accept')?.includes('application/x-ndjson') ?? false
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
  const entryDate = isISODate(input.entryDate) ? input.entryDate : null

  const { mood, energy } = input
  if (
    !Number.isInteger(mood) || (mood as number) < 1 || (mood as number) > 5 ||
    !Number.isInteger(energy) || (energy as number) < 1 || (energy as number) > 5
  ) {
    return NextResponse.json({ error: 'mood, energy は 1〜5 の整数で指定してください' }, { status: 400 })
  }

  for (const field of NOTE_FIELDS) {
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
      // 生成パラメータは評価スクリプトと共有（lib/draft-prompt.ts の DRAFT_GENERATION・draftMaxTokens）
      ...DRAFT_GENERATION,
      max_tokens: draftMaxTokens(input),
      stream: true,
      messages: [
        { role: 'system', content: DRAFT_SYSTEM_PROMPT },
        { role: 'user', content: buildDraftUserPrompt(input, entryDate) },
      ],
    }, { signal: req.signal })

    const encoder = new TextEncoder()
    let cancelled = false
    const abortModel = () => stream.controller.abort()
    req.signal.addEventListener('abort', abortModel, { once: true })
    if (req.signal.aborted) abortModel()
    const readable = new ReadableStream({
      async start(controller) {
        let terminalSent = false
        const send = (frame: DraftStreamFrame) => {
          if (cancelled || terminalSent) return
          if (framed) controller.enqueue(encoder.encode(`${JSON.stringify(frame)}\n`))
          else if (frame.type === 'delta') controller.enqueue(encoder.encode(frame.text))
          else if (frame.type === 'error') controller.enqueue(encoder.encode(DRAFT_CUT_MARK))
          if (frame.type !== 'delta') terminalSent = true
        }
        try {
          for await (const chunk of stream) {
            if (cancelled) break
            const choice = chunk.choices[0]
            const delta = choice?.delta?.content ?? ''
            if (delta) send({ type: 'delta', text: delta })
            if (choice?.finish_reason) {
              send(choice.finish_reason === 'stop'
                ? { type: 'done' }
                : { type: 'error', reason: choice.finish_reason === 'length' ? 'length' : 'interrupted' })
              break
            }
          }
          // finish_reason の欠落も中断として扱う（接続終了だけでは成功を確認できない）。
          if (!terminalSent) send({ type: 'error', reason: 'interrupted' })
        } catch (err) {
          console.error('GROQ stream error:', err)
          send({ type: 'error', reason: 'interrupted' })
        } finally {
          req.signal.removeEventListener('abort', abortModel)
        }
        if (!cancelled) controller.close()
      },
      cancel() {
        cancelled = true
        abortModel()
        req.signal.removeEventListener('abort', abortModel)
      },
    })

    return new NextResponse(readable, {
      headers: { ...PLAIN_HEADERS, Vary: 'Accept', ...(framed ? { 'Content-Type': 'application/x-ndjson; charset=utf-8' } : {}) },
    })
  } catch (err) {
    console.error('GROQ draft generation error:', err)
    // フォールバック
    const result = generateOfflineDraft(input, entryDate)
    return new NextResponse(result.draft, {
      headers: { ...PLAIN_HEADERS, 'X-Draft-Fallback': '1' },
    })
  }
}
