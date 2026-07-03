import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase-admin'

// 毎日のリマインダー配信（Vercel Cron から呼ばれる）。
// - 「今日（JST）まだ記録していない」購読ユーザーだけに送る
// - 昨日の気分があれば文面に差し込む（データが会話のきっかけになる）
// - 無効になった購読（410/404）は自動削除する
//
// Vercel の Cron は Authorization: Bearer ${CRON_SECRET} を自動付与する。
// 手動テスト: curl -H "Authorization: Bearer <CRON_SECRET>" https://<app>/api/cron/reminder

export const maxDuration = 60

const MOOD_EMOJI: Record<number, string> = { 1: '😞', 2: '😕', 3: '😐', 4: '🙂', 5: '😄' }

function jstDate(offsetDays = 0): string {
  const now = new Date()
  now.setUTCDate(now.getUTCDate() + offsetDays)
  return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
}

export async function GET(req: NextRequest) {
  // 1. Cron 以外からの呼び出しを弾く
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. VAPID 設定確認
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) {
    return NextResponse.json({ error: 'VAPID キーが未設定です' }, { status: 503 })
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com',
    publicKey,
    privateKey
  )

  let supabase: ReturnType<typeof createAdminClient>
  try {
    supabase = createAdminClient()
  } catch (err) {
    console.error('Cron: Service Role クライアントを初期化できません:', err)
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY が未設定のため配信できません' },
      { status: 503 }
    )
  }
  const today = jstDate(0)
  const yesterday = jstDate(-1)

  // 3. 全購読を取得
  const { data: subs, error: subsError } = await supabase
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth')

  if (subsError) {
    console.error('Cron: 購読取得に失敗:', subsError)
    return NextResponse.json({ error: '購読取得に失敗しました' }, { status: 500 })
  }
  if (!subs || subs.length === 0) {
    return NextResponse.json({ sent: 0, skipped: 0, removed: 0 })
  }

  const userIds = Array.from(new Set(subs.map((s) => s.user_id)))

  // 4. 今日すでに記録済みのユーザーを除外
  const { data: todayEntries } = await supabase
    .from('diary_entries')
    .select('user_id')
    .eq('entry_date', today)
    .in('user_id', userIds)
  const recordedToday = new Set((todayEntries ?? []).map((e) => e.user_id))

  // 5. 昨日の気分（文面のパーソナライズ用）
  const { data: yesterdayEntries } = await supabase
    .from('diary_entries')
    .select('user_id, mood')
    .eq('entry_date', yesterday)
    .in('user_id', userIds)
  const yesterdayMood = new Map((yesterdayEntries ?? []).map((e) => [e.user_id, e.mood as number]))

  // 6. 送信
  let sent = 0
  let removed = 0
  const targets = subs.filter((s) => !recordedToday.has(s.user_id))

  await Promise.all(
    targets.map(async (sub) => {
      const mood = yesterdayMood.get(sub.user_id)
      const body = mood
        ? `昨日の気分は${MOOD_EMOJI[mood] ?? ''}でした。今日はどんな一日でしたか？30秒だけふり返ってみませんか`
        : '今日はまだ記録がありません。30秒だけ、今日をふり返ってみませんか？'

      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title: 'Inner Mirror 🪞', body, url: '/checkin' })
        )
        sent++
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode
        // 期限切れ・解除済みの購読は掃除する
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
          removed++
        } else {
          console.error('Cron: push 送信失敗:', statusCode, err)
        }
      }
    })
  )

  return NextResponse.json({ sent, skipped: subs.length - targets.length, removed })
}
