import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { encryptSecret } from '@/lib/crypto'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  // OAuthエラー
  if (error) {
    console.error('OAuth callback error:', error, errorDescription)
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorDescription ?? error)}`
    )
  }

  if (code) {
    try {
      const supabase = await createServerSupabaseClient()
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

      if (exchangeError) {
        console.error('Code exchange error:', exchangeError)
        return NextResponse.redirect(
          `${origin}/login?error=${encodeURIComponent(exchangeError.message)}`
        )
      }

      // Google の provider_refresh_token はサインイン直後のセッションにしか含まれない。
      // Calendar API で後から使えるよう、ここで profiles に保存しておく（失敗してもログインは続行）
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const refreshToken = session?.provider_refresh_token
        const userId = session?.user?.id
        if (refreshToken && userId) {
          await supabase
            .from('profiles')
            .update({ google_refresh_token: encryptSecret(refreshToken) })
            .eq('id', userId)
        }
      } catch (tokenErr) {
        console.warn('Google refresh token の保存に失敗（無視）:', tokenErr)
      }

      // ログイン成功 → リダイレクト
      return NextResponse.redirect(`${origin}${next}`)
    } catch (err) {
      console.error('Callback route error:', err)
      return NextResponse.redirect(`${origin}/login?error=callback_error`)
    }
  }

  // コードなし → ログインページに戻す
  return NextResponse.redirect(`${origin}/login`)
}
