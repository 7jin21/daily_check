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

/** 登録状態の照会は期限を設ける。失敗を「購読なし」と扱わない。 */
const REGISTRATION_TIMEOUT_MS = 3000

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('通知の準備がタイムアウトしました')), timeoutMs)
      }),
    ])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

/** この端末の Push 購読（無ければ null）。navigator.serviceWorker.ready は登録が無いと永遠に待つので使わない */
async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await withTimeout(navigator.serviceWorker.getRegistration(), REGISTRATION_TIMEOUT_MS)
  if (!registration) return null
  return withTimeout(registration.pushManager.getSubscription(), REGISTRATION_TIMEOUT_MS)
}

async function deleteServerSubscription(endpoint: string): Promise<void> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)
  try {
    const response = await fetch('/api/push/subscribe', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error('サーバーの通知購読を削除できませんでした')
  } finally {
    clearTimeout(timer)
  }
}

async function stopBrowserSubscription(subscription: PushSubscription): Promise<boolean> {
  const removed = await withTimeout(subscription.unsubscribe(), REGISTRATION_TIMEOUT_MS)
  return removed || !(await currentSubscription())
}

export async function subscribeToPush(): Promise<PushSubscribeResult> {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' }
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!publicKey) return { ok: false, reason: 'not_configured' }

  try {
    // requestPermission はユーザー操作（トグルのタップ）から呼ばれる必要がある
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return { ok: false, reason: 'denied' }

    // ready は SW 未登録時に終わらない。期限後の完了から購読処理を再開しない。
    const registration = await withTimeout(navigator.serviceWorker.ready, 10_000)
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
      if (!(await stopBrowserSubscription(subscription))) return { ok: false, reason: 'error' }
      await save(await create())
    }
    return { ok: true }
  } catch (err) {
    console.error('Push 購読に失敗:', err)
    return { ok: false, reason: 'error' }
  }
}

/** 通知トグルを OFF にしたときも、この端末だけを解除する。 */
export async function unsubscribeFromPush(): Promise<{ ok: boolean }> {
  return unsubscribeThisDevice()
}

/**
 * サインアウトの前に呼ぶ: この端末の購読だけを解除する（ほかの端末のリマインダーは残す）。
 * 残すと、サインアウトしたあとも前の人のリマインダー（前日の気分つき）がこの端末に届き続け、
 * 次にこの端末を使う人は通知を登録できない。
 * サーバーの行はログインしている間にしか消せないので、先に消す（電波が無くて消せなくても、
 * 端末の購読を解除すれば次の配信で 410 になり、サーバー側も自動で片付く）
 */
export async function unsubscribeThisDevice(): Promise<{ ok: boolean }> {
  if (!isPushSupported()) return { ok: true }
  try {
    const subscription = await currentSubscription()
    if (!subscription) return { ok: true }
    await deleteServerSubscription(subscription.endpoint).catch((err) => console.warn('購読の削除に失敗（端末側は解除する）:', err))
    // 別アカウントの古い購読はサーバーで消せないため、ブラウザ側の解除確認を必須にする。
    return { ok: await stopBrowserSubscription(subscription) }
  } catch (err) {
    console.error('Push 解除に失敗:', err)
    return { ok: false }
  }
}
