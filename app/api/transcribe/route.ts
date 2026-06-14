import { NextRequest, NextResponse } from 'next/server'
import { createReadonlyServerClient } from '@/lib/supabase-server'
import { getGroqClient, GROQ_MODELS } from '@/lib/groq'

// 端末で録音した音声を受け取り、Groq Whisper で文字起こししてテキストを返す。
// Web Speech API と違い「MediaRecorder で録音 → サーバーで書き起こし」方式は
// iOS の standalone PWA を含む全環境で安定して動作する。

export const runtime = 'nodejs'
export const maxDuration = 60 // 書き起こしに時間がかかるケースの余裕

const MAX_BYTES = 25 * 1024 * 1024 // Groq の音声アップロード上限に合わせる

export async function POST(req: NextRequest) {
  // 1. セッション確認
  const supabase = await createReadonlyServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. GROQ 未設定なら明示エラー（音声は端末側で代替できない）
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: '音声入力は現在利用できません' }, { status: 503 })
  }

  // 3. multipart/form-data から音声ファイルを取得
  let file: File | null = null
  try {
    const form = await req.formData()
    const f = form.get('audio')
    if (f instanceof File) file = f
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  if (!file || file.size === 0) {
    return NextResponse.json({ error: '音声データがありません' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: '録音が長すぎます' }, { status: 413 })
  }

  // 4. Groq Whisper で文字起こし（日本語固定で精度を上げる）
  try {
    const groq = getGroqClient()
    const transcription = await groq.audio.transcriptions.create({
      file,
      model: GROQ_MODELS.transcribe,
      language: 'ja',
      temperature: 0,
      response_format: 'json',
    })
    const text = (transcription.text ?? '').trim()
    return NextResponse.json({ text })
  } catch (err) {
    console.error('GROQ transcription error:', err)
    return NextResponse.json({ error: '音声の文字起こしに失敗しました' }, { status: 500 })
  }
}
