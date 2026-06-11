// BFF API呼び出し用クライアント
// タイムアウト10秒、最大3回リトライ

const DEFAULT_TIMEOUT_MS = 10_000
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1_000

class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries: number = MAX_RETRIES,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options, timeoutMs)

      // 5xx エラーはリトライ対象
      if (response.status >= 500 && attempt < retries) {
        lastError = new ApiError(response.status, `Server error: ${response.status}`)
        await sleep(RETRY_DELAY_MS * (attempt + 1))
        continue
      }

      return response
    } catch (error) {
      if (error instanceof Error) {
        // AbortError (タイムアウト) もリトライ対象
        if (error.name === 'AbortError') {
          lastError = new Error(`Request timeout after ${timeoutMs}ms`)
        } else {
          lastError = error
        }
      } else {
        lastError = new Error('Unknown error')
      }

      if (attempt < retries) {
        await sleep(RETRY_DELAY_MS * (attempt + 1))
      }
    }
  }

  throw lastError ?? new Error('Request failed after retries')
}

// GET リクエスト
export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetchWithRetry(path, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }))
    throw new ApiError(response.status, body.error ?? response.statusText)
  }

  return response.json() as Promise<T>
}

// POST リクエスト
// signal を渡した場合はリトライなし（キャンセル可能な長時間リクエスト向け）
// retry: false で単発リクエスト（Notionページ作成など冪等でない処理向け — リトライすると重複作成される）
export async function apiPost<T>(
  path: string,
  body: unknown,
  options?: { signal?: AbortSignal; retry?: boolean }
): Promise<T> {
  if (options?.signal) {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: options.signal,
    })
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ error: response.statusText }))
      throw new ApiError(response.status, errorBody.error ?? response.statusText)
    }
    return response.json() as Promise<T>
  }

  const response = await fetchWithRetry(
    path,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    options?.retry === false ? 0 : MAX_RETRIES
  )

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: response.statusText }))
    throw new ApiError(response.status, errorBody.error ?? response.statusText)
  }

  return response.json() as Promise<T>
}

export { ApiError }
