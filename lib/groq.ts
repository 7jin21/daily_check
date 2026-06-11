import Groq from 'groq-sdk'

export function getGroqClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY is not set')
  return new Groq({ apiKey })
}

export const GROQ_MODELS = {
  fast: 'llama-3.1-8b-instant',      // 高速・小タスク向け（書き直し）
  quality: 'llama-3.3-70b-versatile', // 高品質（日記生成・分析・週次レポート）
} as const
