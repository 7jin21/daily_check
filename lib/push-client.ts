// Web Push 購読のクライアント側ヘルパー（設定画面の通知トグル・サインアウトから使う）
import { apiPost, ApiError } from '@/lib/api-client'

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

/** Service Worker の登録が無い環境でも待ち続けないための上限（サインアウトを止めない） */
const REGISTRATION_TIMEOUT_MS = 3000

/** この端末の Push 購読（無ければ null）。navigator.serviceWorker.ready は登録が無いと永遠に待つので使わない */
async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await Promise.race([
    navigator.serviceWorker.getRegistration(),
    new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), REGISTRATION_TIMEOUT_MS)),
  ])
  return (await registration?.pushManager.getSubscription()) ?? null
}

async function deleteServerSubscription(endpoint: string | null): Promise<void> {
  await fetch('/api/push/subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(endpoint ? { endpoint } : {}),
  })
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
    const create = () =>
      registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      })
    const save = (s: PushSubscription) => apiPost('/api/push/subscribe', { subscription: s.toJSON() }, { retry: false })

    const subscription = (await registration.pushManager.getSubscription()) ?? (await create())
    try {
      await save(subscription)
    } catch (err) {
      // 409: この端末の購読が、前にこの端末を使った別のアカウントのまま残っている
      // （以前の版はサインアウトで購読を消さなかった）。購読を作り直して、この人の分として登録する。
      // 古い購読は無効になるので、残った行は次の配信で 410 になり自動で消える
      if (!(err instanceof ApiError && err.status === 409)) throw err
      await subscription.unsubscribe()
      await save(await create())
    }
    return { ok: true }
  } catch (err) {
    console.error('Push 購読に失敗:', err)
    return { ok: false, reason: 'error' }
  }
}

/** 通知トグルを OFF にしたとき（この端末の購読を解除。端末の購読が分からないときはこのユーザーの全端末分） */
export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return
  try {
    const subscription = await currentSubscription()
    const endpoint = subscription?.endpoint ?? null
    if (subscription) await subscription.unsubscribe()
    await deleteServerSubscription(endpoint)
  } catch (err) {
    console.error('Push 解除に失敗:', err)
  }
}

/**
 * サインアウトの前に呼ぶ: この端末の購読だけを解除する（ほかの端末のリマインダーは残す）。
 * 残すと、サインアウトしたあとも前の人のリマインダー（前日の気分つき）がこの端末に届き続け、
 * 次にこの端末を使う人は通知を登録できない。
 * サーバーの行はログインしている間にしか消せないので、先に消す（電波が無くて消せなくても、
 * 端末の購読を解除すれば次の配信で 410 になり、サーバー側も自動で片付く）
 */
export async function unsubscribeThisDevice(): Promise<void> {
  if (!isPushSupported()) return
  try {
    const subscription = await currentSubscription()
    if (!subscription) return
    await deleteServerSubscription(subscription.endpoint).catch((err) => console.warn('購読の削除に失敗（端末側は解除する）:', err))
    await subscription.unsubscribe()
  } catch (err) {
    console.error('Push 解除に失敗:', err)
  }
}
