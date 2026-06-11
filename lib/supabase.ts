'use client'

import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// クライアントサイド用Supabaseクライアント
// 環境変数が未設定の場合はnullを返す（開発時のフォールバック）
export function createClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase環境変数が設定されていません。.env.localを確認してください。')
    // ダミーURLでクライアントを作成（開発時のビルドエラー回避）
    return createBrowserClient(
      supabaseUrl ?? 'https://placeholder.supabase.co',
      supabaseAnonKey ?? 'placeholder-key'
    )
  }
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

// シングルトンインスタンス（クライアントサイドで再利用）
let browserClient: ReturnType<typeof createBrowserClient> | null = null

export function getSupabaseClient() {
  if (!browserClient) {
    browserClient = createClient()
  }
  return browserClient
}
