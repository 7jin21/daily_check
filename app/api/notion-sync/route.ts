import { NextRequest, NextResponse } from 'next/server'
import { createReadonlyServerClient } from '@/lib/supabase-server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { decryptSecret } from '@/lib/crypto'
import { moodEmoji } from '@/lib/constants'
import { formatJSTDate } from '@/lib/jst'
import { notionBodyBatches, type NotionBodyBlock } from '@/lib/notion-content'
import { resolveNotionSettings } from '@/lib/notion-settings'
import { NotionLease } from '@/lib/notion-sync-lease'

interface NotionSyncBody {
  entryId: string
  entryDate: string
  draft: string
  tags: string[]
  mood: number
  energy: number
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function validateBody(body: Partial<NotionSyncBody>): string | null {
  if (!body || typeof body !== 'object') return 'Invalid request body'
  if (typeof body.entryId !== 'string' || !UUID_RE.test(body.entryId)) return 'entryId が不正です'
  if (typeof body.entryDate !== 'string' || !DATE_RE.test(body.entryDate)) return 'entryDate が不正です'
  if (typeof body.draft !== 'string' || !body.draft.trim()) return 'draft は必須です'
  if (body.tags != null && (!Array.isArray(body.tags) || body.tags.some((t) => typeof t !== 'string'))) {
    return 'tags は文字列の配列で指定してください'
  }
  if (!Number.isInteger(body.mood) || (body.mood as number) < 1 || (body.mood as number) > 5) return 'mood が不正です'
  if (!Number.isInteger(body.energy) || (body.energy as number) < 1 || (body.energy as number) > 5) return 'energy が不正です'
  return null
}

export async function POST(req: NextRequest) {
  // セッション確認
  const supabase = await createReadonlyServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // リクエストボディ検証
  let body: NotionSyncBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const validationError = validateBody(body)
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 })
  }

  const serverSupabase = await createServerSupabaseClient()

  // エントリーの存在・所有権・同期済みかを確認
  // 所有権を先に確認。同期先IDと本文はlease取得後に改めて読む。
  const { data: entry, error: entryError } = await serverSupabase
    .from('diary_entries')
    .select('id, notion_page_id')
    .eq('id', body.entryId)
    .eq('user_id', user.id)
    .single()

  if (entryError || !entry) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
  }

  // ユーザーのNotion設定を取得
  const { data: profile, error: profileError } = await serverSupabase
    .from('profiles')
    .select('notion_token, notion_database_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const notion = resolveNotionSettings(profile)
  if (notion.disabled || !notion.token || !notion.databaseId) {
    return NextResponse.json({ skipped: true })
  }
  // 復号失敗時にも別のアカウントの既定値へ切り替えない。
  let notionToken: string
  try {
    notionToken = decryptSecret(notion.token)
  } catch (err) {
    console.error('Notion token decryption error:', err)
    return NextResponse.json({ error: 'Notion設定を読み取れませんでした' }, { status: 500 })
  }

  const lease = new NotionLease(serverSupabase, body.entryId)
  let acquired = false
  let createdPageId: string | null = null
  let createdBodyComplete = false
  let preparationStarted = false
  let creationAttempted = false
  const call: NotionCall = async (url, method, payload) => {
    await lease.transition('renew')
    // prepare/renewの応答失敗と、送信後に作成結果が不明なケースを区別する。
    if (method === 'POST' && url === 'https://api.notion.com/v1/pages') creationAttempted = true
    return notionFetch(notionToken, url, method, payload)
  }

  // Notion API呼び出し
  try {
    const state = await lease.acquire()
    if (!state) return NextResponse.json({ error: 'sync_busy' }, { status: 409, headers: { 'Retry-After': '1' } })
    acquired = true
    if (state.createPending && !state.pageId) {
      return NextResponse.json({
        error: 'sync_recovery_required',
        details: '前回のNotionページ作成結果を確認できません。重複を避けるため、同期を停止しています。',
      }, { status: 409 })
    }
    // 待機中に保存された新しい本文を同期し、古いリクエストで本文を巻き戻さない。
    const { data: current, error: currentError } = await serverSupabase.from('diary_entries')
      .select('entry_date, mood, energy, edited_draft, ai_draft, tags, notion_page_id')
      .eq('id', body.entryId).eq('user_id', user.id).single()
    if (currentError || !current) throw new Error('同期する日記を取得できませんでした')
    const draft = current.edited_draft || current.ai_draft
    if (!draft?.trim() || current.mood == null || current.energy == null) return NextResponse.json({ skipped: true })
    body = { ...body, entryDate: current.entry_date, draft, mood: current.mood, energy: current.energy, tags: current.tags ?? [] }
    const icon = { emoji: moodEmoji(body.mood) ?? '📓' }
    const properties = {
      title: {
        title: [
          {
            text: {
              content: formatJSTDate(body.entryDate, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long',
              }),
            },
          },
        ],
      },
      '日付': {
        date: { start: body.entryDate },
      },
      '気分': {
        number: body.mood,
      },
      'エネルギー': {
        number: body.energy,
      },
      'タグ': {
        multi_select: body.tags.map((tag) => ({ name: tag })),
      },
    }
    const batches = notionBodyBatches(body.draft)
    let notionPageId = state.pageId
    if (notionPageId) {
      if (state.createPending) {
        // 補償アーカイブの後でDB応答だけ失われた場合も、既知の同じページから回復する。
        await call(`https://api.notion.com/v1/pages/${notionPageId}`, 'PATCH', { archived: false })
      }
      await updateNotionPage(call, notionPageId, icon, properties, batches)
    } else {
      preparationStarted = true
      await lease.transition('prepare_create')
      notionPageId = await createNotionPage(call, notion.databaseId, icon, properties, batches, async (id) => {
        createdPageId = id
        // まず回復用IDを永続化。日記への確定保存が失敗しても、このページを再利用できる。
        await lease.transition('checkpoint', id)
      })
      createdBodyComplete = true
    }
    // 現在leaseの確認、日記へのID保存、pending解除を同じDBトランザクションで実行。
    await lease.transition('finalize', notionPageId)

    return NextResponse.json({ success: true, notionPageId })
  } catch (err) {
    if (acquired && createdPageId && !createdBodyComplete) {
      try {
        // leaseを失った旧workerは補償を行わない。新workerがこのページを回復済みかもしれない。
        const current = await lease.transition('renew')
        if (current.pageId && current.pageId !== createdPageId) throw new Error('Notion recovery page changed')
        await call(`https://api.notion.com/v1/pages/${createdPageId}`, 'PATCH', { archived: true })
        await lease.transition('discard', createdPageId)
      } catch (cleanupErr) {
        console.warn('未完了Notionページの回復が必要です:', cleanupErr)
      }
    } else if (acquired && preparationStarted && !creationAttempted) {
      // 外部POSTの前なら作成は起きていない。同じleaseを保持している場合だけpendingを戻す。
      try {
        const current = await lease.transition('renew')
        if (current.createPending && !current.pageId) await lease.transition('discard')
      } catch (cleanupErr) {
        console.warn('Notion作成準備の回復に失敗:', cleanupErr)
      }
    } else if (acquired && creationAttempted && !createdPageId && err instanceof NotionHttpError && err.status < 500) {
      // Notionが明確に拒否した場合だけ再作成を許す。タイムアウト等の結果不明ではpendingを維持。
      await lease.transition('discard').catch((cleanupErr) => console.warn('Notion作成状態の解除に失敗:', cleanupErr))
    }
    console.error('Notion sync error:', err)
    // Notion同期失敗はSupabase保存に影響しない
    return NextResponse.json(
      { error: 'Notion同期に失敗しました', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  } finally {
    if (acquired) await lease.release()
  }
}

const NOTION_HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
  'Notion-Version': '2022-06-28',
})

async function notionFetch(token: string, url: string, method: string, payload?: unknown) {
  const response = await fetch(url, {
    method,
    headers: NOTION_HEADERS(token),
    body: payload !== undefined ? JSON.stringify(payload) : undefined,
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as { message?: string }
    throw new NotionHttpError(response.status, errorData.message ?? `Notion API error: ${response.status}`)
  }
  return response.json()
}

class NotionHttpError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}
type NotionCall = (url: string, method: string, payload?: unknown) => Promise<unknown>

async function createNotionPage(
  call: NotionCall,
  databaseId: string,
  icon: unknown,
  properties: unknown,
  batches: NotionBodyBlock[][],
  checkpoint: (pageId: string) => Promise<void>
): Promise<string> {
  const [first = [], ...rest] = batches
  const data = await call('https://api.notion.com/v1/pages', 'POST', {
    parent: { database_id: databaseId },
    icon,
    properties,
    children: first,
  }) as { id: string }
  if (!data.id) throw new Error('NotionページIDを取得できませんでした')
  await checkpoint(data.id)
  for (const batch of rest) {
    await call(`https://api.notion.com/v1/blocks/${data.id}/children`, 'PATCH', { children: batch })
  }
  return data.id
}

// 既存ページのプロパティ・アイコンを更新し、本文ブロックを差し替える
async function updateNotionPage(
  call: NotionCall,
  pageId: string,
  icon: unknown,
  properties: unknown,
  batches: NotionBodyBlock[][]
): Promise<string> {
  // 旧本文は全ページ読む。新しい全文を追加できるまでは削除しない。
  const blockIds: string[] = []
  let cursor: string | null = null
  do {
    const query: string = cursor ? `page_size=100&start_cursor=${encodeURIComponent(cursor)}` : 'page_size=100'
    const children = await call(`https://api.notion.com/v1/blocks/${pageId}/children?${query}`, 'GET') as {
      results?: Array<{ id: string }>
      has_more?: boolean
      next_cursor?: string | null
    }
    blockIds.push(...(children.results ?? []).map((b) => b.id))
    if (children.has_more && !children.next_cursor) throw new Error('Notion本文の続きを取得できませんでした')
    cursor = children.has_more ? children.next_cursor ?? null : null
  } while (cursor)

  const newIds: string[] = []
  try {
    for (const batch of batches) {
      const added = await call(`https://api.notion.com/v1/blocks/${pageId}/children`, 'PATCH', { children: batch }) as { results: Array<{ id: string }> }
      newIds.push(...added.results.map((block) => block.id))
    }
    await call(`https://api.notion.com/v1/pages/${pageId}`, 'PATCH', { icon, properties })
  } catch (err) {
    for (const id of newIds) {
      await call(`https://api.notion.com/v1/blocks/${id}`, 'DELETE').catch((cleanupErr) => console.warn('追加本文の回復に失敗:', cleanupErr))
    }
    throw err
  }

  for (const id of blockIds) await call(`https://api.notion.com/v1/blocks/${id}`, 'DELETE')

  return pageId
}
