import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Service Role クライアント（RLS をバイパスする管理用）。
// Cron ジョブなど「ユーザーセッションが存在しない」サーバー処理専用。
// SUPABASE_SERVICE_ROLE_KEY は絶対にクライアントへ出さないこと。
export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY（または SUPABASE_URL）が未設定です')
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
