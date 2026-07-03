// Web Push 購読のクライアント側ヘルパー（設定画面の通知トグルから使う）
import { apiPost } from '@/lib/api-client'

export type PushSubscribeResult =
  | { ok: true }
  | { ok: false; reason: 'unsupported' | 'not_configured' | 'denied' | 'error' }

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from(rawData, (c) => c.charCodeAt(0))
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export function isPushConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
}

export async function subscribeToPush(): Promise<PushSubscribeResult> {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' }
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!publicKey) return { ok: false, reason: 'not_configured' }

  try {
    // requestPermission はユーザー操作（トグルのタップ）から呼ばれる必要がある
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return { ok: false, reason: 'denied' }

    const registration = await navigator.serviceWorker.ready
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      }))

    await apiPost('/api/push/subscribe', { subscription: subscription.toJSON() }, { retry: false })
    return { ok: true }
  } catch (err) {
    console.error('Push 購読に失敗:', err)
    return { ok: false, reason: 'error' }
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    const endpoint = subscription?.endpoint
    if (subscription) await subscription.unsubscribe()
    // サーバー側の購読行も削除（endpoint 不明時はこのユーザーの全端末分）
    await fetch('/api/push/subscribe', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(endpoint ? { endpoint } : {}),
    })
  } catch (err) {
    console.error('Push 解除に失敗:', err)
  }
}
