import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { subscribeToPush, unsubscribeThisDevice } from '@/lib/push-client'

// ブラウザの Push まわり（Service Worker・PushManager・fetch）を、呼ばれた順に記録する偽物に差し替える
const log: string[] = []
let subscription: ReturnType<typeof fakeSubscription> | null
let registration: { pushManager: { getSubscription: () => Promise<unknown>; subscribe: () => Promise<unknown> } } | undefined
let postStatuses: number[]
let deleteFails: boolean
let serial = 0

function fakeSubscription(endpoint: string) {
  return {
    endpoint,
    toJSON: () => ({ endpoint, keys: { p256dh: 'p', auth: 'a' } }),
    unsubscribe: vi.fn(async () => {
      log.push(`unsubscribe ${endpoint}`)
      subscription = null
      return true
    }),
  }
}

function stubBrowser(getRegistration: () => Promise<unknown> = async () => registration) {
  vi.stubGlobal('window', { PushManager: function PushManager() {}, Notification: {} })
  vi.stubGlobal('Notification', { requestPermission: async () => 'granted' })
  vi.stubGlobal('navigator', { serviceWorker: { getRegistration, get ready() { return Promise.resolve(registration) } } })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      const body = init.body ? JSON.parse(init.body as string) : null
      if (init.method === 'DELETE') {
        log.push(`DELETE ${body?.endpoint ?? '(全端末)'}`)
        if (deleteFails) throw new TypeError('Load failed')
        return new Response(JSON.stringify({ success: true }), { status: 200 })
      }
      const status = postStatuses.shift() ?? 200
      log.push(`POST ${body.subscription.endpoint} → ${status}`)
      return new Response(JSON.stringify(status === 200 ? { success: true } : { error: 'x' }), { status })
    })
  )
}

beforeEach(() => {
  log.length = 0
  serial = 0
  postStatuses = []
  deleteFails = false
  subscription = fakeSubscription('https://push.example/old')
  registration = {
    pushManager: {
      getSubscription: async () => subscription,
      subscribe: async () => {
        subscription = fakeSubscription(`https://push.example/new-${++serial}`)
        log.push(`subscribe ${subscription.endpoint}`)
        return subscription
      },
    },
  }
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
})

describe('unsubscribeThisDevice（サインアウトの前）', () => {
  it('この端末の購読だけを、サーバーの行 → 端末の購読の順に消す（ログイン中にしか行を消せないため）', async () => {
    stubBrowser()
    await unsubscribeThisDevice()
    expect(log).toEqual(['DELETE https://push.example/old', 'unsubscribe https://push.example/old'])
  })

  it('この端末に購読が無ければ何もしない（ほかの端末のリマインダーまで消さない）', async () => {
    subscription = null
    stubBrowser()
    await unsubscribeThisDevice()
    expect(log).toEqual([])
  })

  it('Service Worker が登録されていなくても待ち続けない（サインアウトを止めない）', async () => {
    stubBrowser(async () => undefined)
    await unsubscribeThisDevice()
    expect(log).toEqual([])

    // 登録の問い合わせが返ってこない環境でも、上限の時間で先へ進む
    vi.useFakeTimers()
    stubBrowser(() => new Promise(() => {}))
    const done = unsubscribeThisDevice()
    await vi.advanceTimersByTimeAsync(3000)
    await expect(done).resolves.toBeUndefined()
  })

  it('電波が無くてサーバーの行を消せなくても、端末の購読は解除する（次の配信で 410 になり自動で片付く）', async () => {
    deleteFails = true
    stubBrowser()
    await unsubscribeThisDevice()
    expect(log).toEqual(['DELETE https://push.example/old', 'unsubscribe https://push.example/old'])
  })
})

describe('subscribeToPush', () => {
  it('いまの購読をそのまま登録する', async () => {
    stubBrowser()
    await expect(subscribeToPush()).resolves.toEqual({ ok: true })
    expect(log).toEqual(['POST https://push.example/old → 200'])
  })

  it('前に別のアカウントで登録された購読が残っていたら（409）、作り直してこの人の分として登録する', async () => {
    postStatuses = [409, 200]
    stubBrowser()
    await expect(subscribeToPush()).resolves.toEqual({ ok: true })
    expect(log).toEqual([
      'POST https://push.example/old → 409',
      'unsubscribe https://push.example/old',
      'subscribe https://push.example/new-1',
      'POST https://push.example/new-1 → 200',
    ])
  })

  it('ほかの失敗では作り直さずに失敗を返す', async () => {
    postStatuses = [500]
    stubBrowser()
    await expect(subscribeToPush()).resolves.toEqual({ ok: false, reason: 'error' })
    expect(log).toEqual(['POST https://push.example/old → 500'])
  })
})
