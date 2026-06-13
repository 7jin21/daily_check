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
//
// 環境変数 GROQ_MODEL_QUALITY / GROQ_MODEL_FAST で上書き可能（モデル入れ替えに追従しやすく）
export const GROQ_MODELS = {
  fast: process.env.GROQ_MODEL_FAST || 'openai/gpt-oss-20b',
  quality: process.env.GROQ_MODEL_QUALITY || 'moonshotai/kimi-k2-instruct-0905',
} as const
