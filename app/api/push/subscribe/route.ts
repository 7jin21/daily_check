import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// Web Push 購読の登録・解除。購読情報（endpoint / 鍵）は端末ごとに1行保存する。
// 送信は /api/cron/reminder が行う。

interface SubscriptionJSON {
  endpoint?: string
  keys?: { p256dh?: string; auth?: string }
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let sub: SubscriptionJSON
  try {
    const body = (await req.json()) as { subscription?: SubscriptionJSON }
    sub = body.subscription ?? {}
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const endpoint = typeof sub.endpoint === 'string' ? sub.endpoint : ''
  const p256dh = typeof sub.keys?.p256dh === 'string' ? sub.keys.p256dh : ''
  const auth = typeof sub.keys?.auth === 'string' ? sub.keys.auth : ''

  if (!endpoint.startsWith('https://') || !p256dh || !auth) {
    return NextResponse.json({ error: '購読情報が不正です' }, { status: 400 })
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      { user_id: user.id, endpoint, p256dh, auth },
      { onConflict: 'endpoint' }
    )

  if (error) {
    console.error('Push subscription save error:', error)
    return NextResponse.json({ error: '購読の保存に失敗しました' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // endpoint 指定あり = この端末のみ解除 / なし = 自分の全端末を解除
  let endpoint = ''
  try {
    const body = (await req.json()) as { endpoint?: string }
    if (typeof body.endpoint === 'string') endpoint = body.endpoint
  } catch {
    // body なしは「全端末解除」として扱う
  }

  const query = supabase.from('push_subscriptions').delete().eq('user_id', user.id)
  const { error } = endpoint ? await query.eq('endpoint', endpoint) : await query

  if (error) {
    console.error('Push subscription delete error:', error)
    return NextResponse.json({ error: '購読の解除に失敗しました' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
