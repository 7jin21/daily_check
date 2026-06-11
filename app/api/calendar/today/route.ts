import { NextResponse } from 'next/server'
import { createReadonlyServerClient } from '@/lib/supabase-server'
import { decryptSecret } from '@/lib/crypto'

interface CalendarEvent {
  id: string
  title: string
  startTime: string | null
  endTime: string | null
  isAllDay: boolean
}

// profiles に保存した refresh token で Google のアクセストークンを取得する。
// (Supabase の provider_token はサインイン直後しか使えないため、refresh フローが必須)
async function getGoogleAccessToken(refreshToken: string): Promise<string | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) {
    console.error('Google token refresh failed:', response.status)
    return null
  }

  const data = await response.json() as { access_token?: string }
  return data.access_token ?? null
}

export async function GET() {
  // セッション確認
  const supabase = await createReadonlyServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Google Calendar設定確認
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    // 未設定の場合は空配列を返す（オプション機能）
    return NextResponse.json({ events: [] as CalendarEvent[], enabled: false })
  }

  try {
    // 1. profiles に保存した refresh token からアクセストークンを取得
    let accessToken: string | null = null

    const { data: profile } = await supabase
      .from('profiles')
      .select('google_refresh_token')
      .eq('id', user.id)
      .single()

    if (profile?.google_refresh_token) {
      try {
        const refreshToken = decryptSecret(profile.google_refresh_token)
        accessToken = await getGoogleAccessToken(refreshToken)
      } catch (err) {
        console.error('Google refresh token の復号に失敗:', err)
      }
    }

    // 2. フォールバック: サインイン直後ならセッションの provider_token が使える
    if (!accessToken) {
      const { data: { session } } = await supabase.auth.getSession()
      accessToken = session?.provider_token ?? null
    }

    if (!accessToken) {
      return NextResponse.json({
        events: [] as CalendarEvent[],
        enabled: true,
        error: 'Google Calendar未接続（Googleで再ログインすると接続されます）',
      })
    }

    // 今日の日付範囲（Asia/Tokyo 基準）
    const todayJST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
    const startOfDay = new Date(`${todayJST}T00:00:00+09:00`)
    const endOfDay = new Date(`${todayJST}T00:00:00+09:00`)
    endOfDay.setDate(endOfDay.getDate() + 1)

    const params = new URLSearchParams({
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '10',
    })

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { error?: { message?: string } }
      throw new Error(errorData.error?.message ?? `Calendar API error: ${response.status}`)
    }

    const data = await response.json() as {
      items: Array<{
        id: string
        summary?: string
        start: { dateTime?: string; date?: string }
        end: { dateTime?: string; date?: string }
      }>
    }

    const events: CalendarEvent[] = (data.items ?? []).map((item) => ({
      id: item.id,
      title: item.summary ?? '(タイトルなし)',
      startTime: item.start.dateTime ?? null,
      endTime: item.end.dateTime ?? null,
      isAllDay: !item.start.dateTime,
    }))

    return NextResponse.json({ events, enabled: true })
  } catch (err) {
    console.error('Google Calendar API error:', err)
    return NextResponse.json({
      events: [] as CalendarEvent[],
      enabled: true,
      error: err instanceof Error ? err.message : 'Calendar取得失敗',
    })
  }
}
