import { randomUUID } from 'crypto'

interface LeaseState { acquired?: boolean; pageId: string | null; createPending: boolean }
interface RpcClient {
  rpc(name: string, params: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>
}
type Action = 'renew' | 'prepare_create' | 'checkpoint' | 'finalize' | 'discard' | 'release'

export class NotionLease {
  private readonly id = randomUUID()
  constructor(private readonly db: RpcClient, private readonly entryId: string) {}

  async acquire(): Promise<LeaseState | null> {
    // Brief contention is resolved within this request; the client retries sync_busy only.
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data, error } = await this.db.rpc('acquire_notion_sync', { p_entry_id: this.entryId, p_lease_id: this.id })
      if (error) throw new Error(`Notion sync lock: ${error.message}`)
      const state = data as LeaseState
      if (state?.acquired) return state
      if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, 250))
    }
    return null
  }

  async transition(action: Action, pageId: string | null = null): Promise<LeaseState> {
    const { data, error } = await this.db.rpc('transition_notion_sync', {
      p_entry_id: this.entryId, p_lease_id: this.id, p_action: action, p_page_id: pageId,
    })
    if (error) throw new Error(`Notion sync ${action}: ${error.message}`)
    return data as LeaseState
  }

  async release(): Promise<void> {
    // If the response is lost the lease still expires; recovery checkpoints remain durable.
    await this.transition('release').catch((err) => console.warn('Notion lease release failed:', err))
  }
}
