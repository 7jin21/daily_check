import { NextRequest, NextResponse } from 'next/server'
import { createReadonlyServerClient } from '@/lib/supabase-server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { decryptSecret } from '@/lib/crypto'
import { moodEmoji } from '@/lib/constants'
import { formatJSTDate } from '@/lib/jst'
import { inBatches, toNotionParagraphs } from '@/lib/notion-blocks'

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
  const tags = body.tags ?? []

  const serverSupabase = await createServerSupabaseClient()

  // エントリーの存在・所有権・同期済みかを確認
  // 同期済みなら既存ページを更新する（再送やリトライでも重複ページは作られない）
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

  // DB のトークンは暗号化されている場合があるため復号する（平文ならそのまま返る）
  let storedToken = ''
  try {
    storedToken = profile.notion_token ? decryptSecret(profile.notion_token) : ''
  } catch (err) {
    console.error('Notion token decryption error:', err)
  }

  // || を使う: 空文字の場合も環境変数にフォールバックさせる
  const notionToken = storedToken || process.env.NOTION_API_KEY
  const notionDatabaseId = profile.notion_database_id || process.env.NOTION_DATABASE_ID

  if (!notionToken || !notionDatabaseId) {
    return NextResponse.json({ error: 'Notion設定が未設定です', skipped: true }, { status: 200 })
  }

  // Notion API呼び出し
  try {
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
        multi_select: tags.map((tag) => ({ name: tag })),
      },
    }
    // 本文は2000文字ごとの段落ブロックに分ける（Notion の上限。以前は2000文字で切り捨てていた）
    const bodyBlocks = toNotionParagraphs(body.draft)

    const notionPageId = entry.notion_page_id
      ? await updateNotionPage(notionToken, entry.notion_page_id, icon, properties, bodyBlocks)
      : await createNotionPage(notionToken, notionDatabaseId, icon, properties, bodyBlocks)

    // Supabaseにページ IDを保存
    await serverSupabase
      .from('diary_entries')
      .update({
        notion_page_id: notionPageId,
        notion_synced_at: new Date().toISOString(),
      })
      .eq('id', body.entryId)
      .eq('user_id', user.id)

    return NextResponse.json({ success: true, notionPageId })
  } catch (err) {
    console.error('Notion sync error:', err)
    // Notion同期失敗はSupabase保存に影響しない
    return NextResponse.json(
      { error: 'Notion同期に失敗しました', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
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
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as { message?: string }
    throw new Error(errorData.message ?? `Notion API error: ${response.status}`)
  }
  return response.json()
}

async function createNotionPage(
  token: string,
  databaseId: string,
  icon: unknown,
  properties: unknown,
  bodyBlocks: unknown[]
): Promise<string> {
  // 1回に送れるのは100ブロックまで。ページは最初の100ブロックで作り、残りは続けて足す
  const [first = [], ...rest] = inBatches(bodyBlocks)
  const data = await notionFetch(token, 'https://api.notion.com/v1/pages', 'POST', {
    parent: { database_id: databaseId },
    icon,
    properties,
    children: first,
  }) as { id: string }
  for (const batch of rest) {
    await notionFetch(token, `https://api.notion.com/v1/blocks/${data.id}/children`, 'PATCH', { children: batch })
  }
  return data.id
}

// 既存ページのプロパティ・アイコンを更新し、本文ブロックを差し替える
async function updateNotionPage(
  token: string,
  pageId: string,
  icon: unknown,
  properties: unknown,
  bodyBlocks: unknown[]
): Promise<string> {
  await notionFetch(token, `https://api.notion.com/v1/pages/${pageId}`, 'PATCH', {
    icon,
    properties,
  })

  // 本文の差し替え: 既存ブロックを（100件を超えていても）すべて削除して新しい本文を追加
  const blockIds: string[] = []
  let cursor: string | null = null
  do {
    const query: string = cursor ? `page_size=100&start_cursor=${encodeURIComponent(cursor)}` : 'page_size=100'
    const children = await notionFetch(token, `https://api.notion.com/v1/blocks/${pageId}/children?${query}`, 'GET') as {
      results?: Array<{ id: string }>
      has_more?: boolean
      next_cursor?: string | null
    }
    blockIds.push(...(children.results ?? []).map((b) => b.id))
    cursor = children.has_more ? children.next_cursor ?? null : null
  } while (cursor)

  for (const id of blockIds) {
    await notionFetch(token, `https://api.notion.com/v1/blocks/${id}`, 'DELETE')
  }

  for (const batch of inBatches(bodyBlocks)) {
    await notionFetch(token, `https://api.notion.com/v1/blocks/${pageId}/children`, 'PATCH', { children: batch })
  }

  return pageId
}
