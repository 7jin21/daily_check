import Groq from 'groq-sdk'

export function getGroqClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY is not set')
  return new Groq({ apiKey })
}

// モデル選定の方針:
// - quality: 日本語の自然さ最優先。Kimi K2 は CJK に非常に強く、日記・分析・書き直しの
//   日本語品質が Llama 系より大きく上。instruct 型なので JSON 出力も安定。
// - fast: タグ・サマリー抽出のような軽量 JSON タスク用。速度重視。
// - transcribe: 音声入力の文字起こし用（Whisper）。turbo は高速・低コストで日本語も実用十分。
//   精度を最優先したい場合は GROQ_MODEL_TRANSCRIBE=whisper-large-v3 に上書き可。
//
// 環境変数 GROQ_MODEL_QUALITY / GROQ_MODEL_FAST / GROQ_MODEL_TRANSCRIBE で上書き可能
export const GROQ_MODELS = {
  fast: process.env.GROQ_MODEL_FAST || 'openai/gpt-oss-20b',
  quality: process.env.GROQ_MODEL_QUALITY || 'moonshotai/kimi-k2-instruct-0905',
  transcribe: process.env.GROQ_MODEL_TRANSCRIBE || 'whisper-large-v3-turbo',
} as const
