import { NextRequest, NextResponse } from 'next/server'
import { createReadonlyServerClient, createServerSupabaseClient } from '@/lib/supabase-server'
import { encryptSecret } from '@/lib/crypto'

// 設定の読み書きを BFF 経由にする理由:
// - Notion トークンを ENCRYPTION_KEY で暗号化してから DB に保存する
// - 生トークンをクライアントへ返さない（hasNotionToken のみ返す）

interface SettingsBody {
  notionToken?: string | null   // undefined = 変更なし / null or '' = 解除 / 文字列 = 新規設定
  notionDatabaseId?: string
  notificationTime?: string
  timezone?: string
}

const TIME_RE = /^\d{2}:\d{2}$/

export async function GET() {
  const supabase = await createReadonlyServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('notion_token, notion_database_id, notification_time, timezone')
    .eq('id', user.id)
    .single()

  if (error) {
    return NextResponse.json({ error: '設定の取得に失敗しました' }, { status: 500 })
  }

  return NextResponse.json({
    hasNotionToken: !!profile.notion_token,
    notionDatabaseId: profile.notion_database_id ?? '',
    notificationTime: profile.notification_time?.slice(0, 5) ?? '21:00',
    timezone: profile.timezone ?? 'Asia/Tokyo',
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: SettingsBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (body.notionToken != null && typeof body.notionToken !== 'string') {
    return NextResponse.json({ error: 'notionToken が不正です' }, { status: 400 })
  }
  if (body.notionToken && body.notionToken.length > 200) {
    return NextResponse.json({ error: 'notionToken が長すぎます' }, { status: 400 })
  }
  if (body.notionDatabaseId != null && (typeof body.notionDatabaseId !== 'string' || body.notionDatabaseId.length > 100)) {
    return NextResponse.json({ error: 'notionDatabaseId が不正です' }, { status: 400 })
  }
  if (body.notificationTime != null && (typeof body.notificationTime !== 'string' || !TIME_RE.test(body.notificationTime))) {
    return NextResponse.json({ error: 'notificationTime は HH:MM 形式で指定してください' }, { status: 400 })
  }
  if (body.timezone != null && (typeof body.timezone !== 'string' || body.timezone.length > 50)) {
    return NextResponse.json({ error: 'timezone が不正です' }, { status: 400 })
  }

  const updates: Record<string, unknown> = { id: user.id }

  if (body.notionToken !== undefined) {
    // 空文字 or null は連携解除、文字列は暗号化して保存
    updates.notion_token = body.notionToken ? encryptSecret(body.notionToken.trim()) : null
  }
  if (body.notionDatabaseId !== undefined) {
    updates.notion_database_id = body.notionDatabaseId.trim() || null
  }
  if (body.notificationTime !== undefined) {
    updates.notification_time = body.notificationTime
  }
  if (body.timezone !== undefined) {
    updates.timezone = body.timezone
  }

  const { error } = await supabase.from('profiles').upsert(updates)

  if (error) {
    console.error('Settings save error:', error)
    return NextResponse.json({ error: '設定の保存に失敗しました' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
