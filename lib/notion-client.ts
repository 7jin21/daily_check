import { apiPost, ApiError } from '@/lib/api-client'

/** Only a known lease conflict is retried; uncertain create outcomes are never retried blindly. */
export async function syncNotion(body: unknown): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await apiPost('/api/notion-sync', body, { retry: false })
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 409 || err.message !== 'sync_busy' || attempt >= 3) throw err
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)))
    }
  }
}
