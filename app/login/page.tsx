'use client'

import { useState } from 'react'
import { getSupabaseClient } from '@/lib/supabase'
import { moonPhasePath } from '@/lib/state-glyph'
import Wbr from '@/components/ui/Wbr'
import './login.css'

// 夜空の星（位置は固定。毎回同じ空）
const STARS = [
  [8, 12, 1.1], [17, 30, 0.7], [26, 8, 0.8], [36, 22, 0.6], [44, 6, 1], [58, 16, 0.7], [66, 34, 0.9],
  [73, 9, 0.6], [81, 24, 1.2], [90, 14, 0.7], [94, 40, 0.6], [12, 48, 0.6], [86, 52, 0.8], [5, 34, 0.7],
] as const

/** ログイン画面の空に浮かぶ満月（ホームの月と同じ描き方） */
function LoginMoon({ className, glow = true }: { className: string; glow?: boolean }) {
  return (
    <svg className={className} viewBox="-50 -50 100 100" aria-hidden="true">
      <defs>
        <radialGradient id={`${className}-glow`}>
          <stop offset="40%" stopColor="#f4ead0" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#f4ead0" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${className}-lit`} cx="38%" cy="34%" r="75%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="55%" stopColor="#f4ead0" />
          <stop offset="100%" stopColor="#f4ead0" stopOpacity="0.86" />
        </radialGradient>
      </defs>
      {/* 水面の映り込みには光の輪を描かない（映り込みの箱で輪が四角く切れて見えるため） */}
      {glow && <circle r="78" fill={`url(#${className}-glow)`} />}
      <path d={moonPhasePath(1, 30)} fill={`url(#${className}-lit)`} />
      <g fill="#8a8170" opacity="0.1">
        <circle cx="-8" cy="-9" r="9" />
        <circle cx="9" cy="-4" r="6" />
        <circle cx="2" cy="11" r="7.5" />
      </g>
    </svg>
  )
}

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
    <div className="lg-page">
      {/* 夜の水鏡（ホームと同じ景色を小さく） */}
      <section className="lg-sky" aria-hidden="true">
        <svg className="lg-stars" width="100%" height="64%" style={{ position: 'absolute', inset: 0 }}>
          {STARS.map(([x, y, r], i) => (
            <circle key={i} cx={`${x}%`} cy={`${y}%`} r={r} opacity={0.75} />
          ))}
        </svg>
        <LoginMoon className="lg-moon" />
        <div className="lg-horizon" />
        <LoginMoon className="lg-reflection" glow={false} />
      </section>

      <div className="lg-body">
        <h1 className="lg-wordmark">Inner Mirror</h1>
        <p className="lg-tagline">あなたの言葉のまま、日記に。</p>

        <ul className="lg-points">
          <li>
            <b>三十秒</b>
            <Wbr text="気分を選ぶだけでも、|記録になる" />
          </li>
          <li>
            <b>言葉のまま</b>
            <Wbr text="AI は言い換えず、|整えるだけ" />
          </li>
          <li>
            <b>自分が見える</b>
            <Wbr text="気分の波と、|大切なものが|浮かぶ" />
          </li>
        </ul>

        <div className="lg-actions">
          <button
            type="button"
            onClick={() => handleOAuthLogin('apple')}
            disabled={isLoading !== null}
            className="btn btn-block lg-apple"
          >
            {isLoading === 'apple' ? (
              <span className="spinner" style={{ borderColor: 'currentColor', borderTopColor: 'transparent' }} aria-label="サインインしています" />
            ) : (
              <>
                <AppleIcon />
                Apple でサインイン
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleOAuthLogin('google')}
            disabled={isLoading !== null}
            className="btn btn-block lg-google"
          >
            {isLoading === 'google' ? (
              <span className="spinner" aria-label="サインインしています" />
            ) : (
              <>
                <GoogleIcon />
                Google でサインイン
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="notice mt-4 w-full max-w-sm" data-tone="danger" role="alert">
            <p>{error}</p>
          </div>
        )}

        <p className="lg-terms">サインインすることで、利用規約とプライバシーポリシーに同意したことになります。</p>
      </div>
    </div>
  )
}

function AppleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}
