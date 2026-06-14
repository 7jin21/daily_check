import Groq from 'groq-sdk'

export function getGroqClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY is not set')
  return new Groq({ apiKey })
}

// モデル選定の方針:
// - quality: 日記生成・分析・書き直しなど品質重視タスク用。日本語が自然で、JSON モード
//   （response_format）とストリーミングが安定している gpt-oss-120b を採用。
//   ※ 以前は moonshotai/kimi-k2-instruct-0905 を使っていたが Groq 側で廃止され 404 になった。
//     qwen3-32b は reasoning モデルで <think> タグが本文に混入し JSON も壊れるため不採用。
// - fast: タグ・サマリー抽出のような軽量 JSON タスク用。速度重視。
// - transcribe: 音声入力の文字起こし用（Whisper）。turbo は高速・低コストで日本語も実用十分。
//   精度を最優先したい場合は GROQ_MODEL_TRANSCRIBE=whisper-large-v3 に上書き可。
//
// 環境変数 GROQ_MODEL_QUALITY / GROQ_MODEL_FAST / GROQ_MODEL_TRANSCRIBE で上書き可能
// （Groq はモデルを頻繁に入れ替えるため、404 が出たら console.groq.com/docs/models で要確認）
export const GROQ_MODELS = {
  fast: process.env.GROQ_MODEL_FAST || 'openai/gpt-oss-20b',
  quality: process.env.GROQ_MODEL_QUALITY || 'openai/gpt-oss-120b',
  transcribe: process.env.GROQ_MODEL_TRANSCRIBE || 'whisper-large-v3-turbo',
} as const
