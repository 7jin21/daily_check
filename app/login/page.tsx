'use client'

import { useState } from 'react'
import { getSupabaseClient } from '@/lib/supabase'

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState<'apple' | 'google' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleOAuthLogin = async (provider: 'apple' | 'google') => {
    setIsLoading(provider)
    setError(null)

    try {
      const supabase = getSupabaseClient()
      const redirectTo = `${window.location.origin}/auth/callback`

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          // Calendar 連携用: readonly スコープを要求し、refresh_token を取得する
          scopes:
            provider === 'google'
              ? 'https://www.googleapis.com/auth/calendar.readonly'
              : undefined,
          queryParams:
            provider === 'google'
              ? { access_type: 'offline', prompt: 'consent' }
              : undefined,
        },
      })

      if (error) setError(error.message)
    } catch {
      setError('ログインに失敗しました。もう一度お試しください。')
    } finally {
      setIsLoading(null)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 relative overflow-hidden bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">

      {/* 背景の装飾オーブ */}
      <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-sky-400/15 blur-3xl animate-float pointer-events-none" />
      <div className="absolute -bottom-16 -right-16 w-80 h-80 rounded-full bg-violet-500/15 blur-3xl animate-float pointer-events-none" style={{ animationDelay: '1.8s' }} />
      <div className="absolute top-1/3 right-0 w-48 h-48 rounded-full bg-sky-300/10 blur-2xl pointer-events-none" />

      {/* ロゴ */}
      <div className="mb-10 text-center animate-slide-up">
        <div className="w-24 h-24 mx-auto mb-5 rounded-3xl animated-gradient flex items-center justify-center shadow-2xl shadow-sky-500/30">
          <span className="text-5xl">🪞</span>
        </div>
        <h1 className="text-4xl font-bold gradient-text tracking-tight">Inner Mirror</h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400 text-base">
          毎日の気づきを、AIが日記に
        </p>
      </div>

      {/* 機能ハイライト */}
      <div className="w-full max-w-sm mb-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <div className="flex justify-center gap-6 text-center">
          {[
            { icon: '⚡', label: '30秒で完了' },
            { icon: '✨', label: 'AI代筆' },
            { icon: '📊', label: '自己分析' },
          ].map((f) => (
            <div key={f.label} className="flex flex-col items-center gap-1">
              <span className="text-2xl">{f.icon}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{f.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ログインボタン */}
      <div className="w-full max-w-sm space-y-3 animate-slide-up" style={{ animationDelay: '0.15s' }}>
        <button
          onClick={() => handleOAuthLogin('apple')}
          disabled={isLoading !== null}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold text-base disabled:opacity-60 active:scale-95 transition-transform shadow-lg"
        >
          {isLoading === 'apple' ? (
            <div className="spinner border-white/30 border-t-white dark:border-slate-900/30 dark:border-t-slate-900" />
          ) : (
            <>
              <AppleIcon />
              <span>Appleでサインイン</span>
            </>
          )}
        </button>

        <button
          onClick={() => handleOAuthLogin('google')}
          disabled={isLoading !== null}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white font-semibold text-base disabled:opacity-60 active:scale-95 transition-transform shadow-sm"
        >
          {isLoading === 'google' ? (
            <div className="spinner" />
          ) : (
            <>
              <GoogleIcon />
              <span>Googleでサインイン</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="mt-4 w-full max-w-sm p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm text-center animate-fade-in">
          {error}
        </div>
      )}

      <p className="mt-10 text-xs text-slate-400 text-center max-w-xs">
        サインインすることで、利用規約とプライバシーポリシーに同意したことになります。
      </p>
    </div>
  )
}

function AppleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}
