import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiPost } from '@/lib/api-client'
import { META_INPUT_LIMIT, metaExcerpt, type StoredEntryText } from '@/lib/entry-merge'
import { hasEntryWithWords, refreshEntryMeta, saveFullEntry, type FullEntry } from '@/lib/entry-save'
import { withReflection } from '@/lib/freeform'

// Supabase のクライアントは、呼ばれた操作を記録するだけの偽物に差し替える。
// 保存の中身（追記したか・どの列に何を書いたか）を、実際の DB なしで確かめるため
const fake = vi.hoisted(() => {
  type Row = Record<string, unknown>
  const state = {
    user: { id: 'user-1' } as { id: string } | null,
    /** maybeSingle() が返す、その日の既存の行 */
    existing: null as Row | null,
    readError: null as { message: string } | null,
    upsertError: null as { message: string } | null,
    updateError: null as { message: string } | null,
    tables: [] as string[],
    selects: [] as string[],
    eqs: [] as [string, unknown][],
    upserts: [] as { payload: Row; opts: unknown }[],
    upsertSelects: [] as string[],
    updates: [] as { payload: Row; col: string; val: unknown }[],
  }

  function client() {
    return {
      auth: {
        getUser: async () => ({ data: { user: state.user } }),
      },
      from(table: string) {
        state.tables.push(table)
        return {
          select(cols: string) {
            state.selects.push(cols)
            const query = {
              eq(col: string, val: unknown) {
                state.eqs.push([col, val])
                return query
              },
              maybeSingle: async () => ({ data: state.existing, error: state.readError }),
            }
            return query
          },
          upsert(payload: Row, opts: unknown) {
            state.upserts.push({ payload, opts })
            return {
              select(cols: string) {
                state.upsertSelects.push(cols)
                return {
                  single: async () =>
                    state.upsertError ? { data: null, error: state.upsertError } : { data: { id: 'entry-1' }, error: null },
                }
              },
            }
          },
          update(payload: Row) {
            return {
              eq: async (col: string, val: unknown) => {
                state.updates.push({ payload, col, val })
                return { error: state.updateError }
              },
            }
          },
        }
      },
    }
  }

  function reset() {
    state.user = { id: 'user-1' }
    state.existing = null
    state.readError = null
    state.upsertError = null
    state.updateError = null
    state.tables = []
    state.selects = []
    state.eqs = []
    state.upserts = []
    state.upsertSelects = []
    state.updates = []
  }

  return { state, client, reset }
})

vi.mock('@/lib/supabase', () => ({ getSupabaseClient: () => fake.client() }))
vi.mock('@/lib/api-client', () => ({ apiPost: vi.fn() }))

const post = vi.mocked(apiPost)
const db = fake.state

const DATE = '2026-10-10'

/** 今回のチェックイン（前後の空白・全角スペースも本人が書いたまま） */
const entry: FullEntry = {
  entryDate: DATE,
  mood: 4,
  energy: 2,
  events: ' 夜ラーメン\n',
  challenges: '眠い',
  gratitude: '',
  freeform: withReflection('　新しいメモ\n', 'Q2', 'A2'),
  aiDraft: '新しい清書',
  editedDraft: '　新しい本文。\n',
  tags: ['食事', '仕事'],
  summary: '今回の要約',
  dominantEmotion: '疲労',
}

/** StoredEntryText のすべての列（型に列が増えたら、ここも増やさないとコンパイルが通らない） */
const STORED_COLUMNS: Record<keyof StoredEntryText, true> = {
  events: true,
  challenges: true,
  gratitude: true,
  freeform: true,
  ai_draft: true,
  edited_draft: true,
  tags: true,
}

const moodOnlyRow = {
  events: null,
  challenges: '',
  gratitude: null,
  freeform: '  ',
  ai_draft: null,
  edited_draft: null,
  tags: null,
  summary: null,
  dominant_emotion: null,
}

const wordedRow = {
  events: '朝ジム',
  challenges: null,
  gratitude: '友達',
  freeform: '前のメモ\n\n【ふりかえり】Q1\n→ A1\n\n【あとから 2026-10-12】あとの一言',
  ai_draft: '前の清書',
  edited_draft: '前の本文。',
  tags: ['仕事', '運動'],
  summary: '前の要約',
  dominant_emotion: '満足',
}

beforeEach(() => {
  fake.reset()
  post.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('saveFullEntry', () => {
  it('その日の行が無ければ、書いた言葉をそのまま新しく保存する', async () => {
    const result = await saveFullEntry(entry)

    expect(result).toEqual({ id: 'entry-1', merged: false, appended: false, draft: entry.editedDraft, tags: entry.tags })
    expect(db.upserts).toHaveLength(1)
    expect(db.upserts[0].payload).toEqual({
      user_id: 'user-1',
      entry_date: DATE,
      mood: 4,
      energy: 2,
      events: ' 夜ラーメン\n',
      challenges: '眠い',
      gratitude: '',
      freeform: '　新しいメモ\n\n\n【ふりかえり】Q2\n→ A2',
      ai_draft: '新しい清書',
      edited_draft: '　新しい本文。\n',
      tags: ['食事', '仕事'],
      summary: '今回の要約',
      dominant_emotion: '疲労',
    })
    // id を渡さないので、同じ日の2回目が一意制約違反にならないよう user_id + entry_date で競合判定する
    expect(db.upserts[0].opts).toEqual({ onConflict: 'user_id,entry_date' })
    expect(db.upsertSelects).toEqual(['id'])
    expect(db.tables.every((t) => t === 'diary_entries')).toBe(true)
    expect(db.eqs).toEqual([
      ['user_id', 'user-1'],
      ['entry_date', DATE],
    ])
  })

  it('気分だけの行には追記せず、そのまま書き込む', async () => {
    db.existing = moodOnlyRow
    const result = await saveFullEntry(entry)

    expect(result.merged).toBe(false)
    expect(result.draft).toBe(entry.editedDraft)
    const payload = db.upserts[0].payload
    expect(payload.events).toBe(entry.events)
    expect(payload.freeform).toBe(entry.freeform)
    expect(payload.edited_draft).toBe(entry.editedDraft)
    expect(payload.tags).toEqual(entry.tags)
    expect(payload.summary).toBe('今回の要約')
    expect(payload.dominant_emotion).toBe('疲労')
  })

  it('言葉のある行があれば、前の言葉を消さずに追記する', async () => {
    db.existing = wordedRow
    const result = await saveFullEntry(entry)

    // 新しい言葉の字下げ（全角スペース）は書いたまま残す。末尾の改行だけ落としてつなぐ
    const draft = '前の本文。\n\n　新しい本文。'
    expect(result).toEqual({ id: 'entry-1', merged: true, appended: true, draft, tags: ['仕事', '運動', '食事'] })
    expect(db.upserts[0].payload).toEqual({
      user_id: 'user-1',
      entry_date: DATE,
      mood: 4,
      energy: 2,
      events: '朝ジム\n 夜ラーメン',
      challenges: '眠い',
      gratitude: '友達',
      freeform: '前のメモ\n　新しいメモ\n\n【ふりかえり】Q1\n→ A1\n\n【あとから 2026-10-12】あとの一言\n\n【ふりかえり】Q2\n→ A2',
      ai_draft: '前の清書\n\n新しい清書',
      edited_draft: draft,
      tags: ['仕事', '運動', '食事'],
      // 今回の分だけの要約で一日を上書きしない（作り直しは refreshEntryMeta が本文全体から行う）
      summary: '前の要約',
      dominant_emotion: '満足',
    })
    expect(db.upserts[0].opts).toEqual({ onConflict: 'user_id,entry_date' })
  })

  it('保存のやり直し（前回の保存が届いていた）では、言葉を二重にせず「追記」ともしない', async () => {
    // 1回目の保存がそのまま入っている行に、同じ内容をもう一度保存する
    db.existing = {
      events: entry.events,
      challenges: entry.challenges,
      gratitude: entry.gratitude,
      freeform: entry.freeform,
      ai_draft: entry.aiDraft,
      edited_draft: entry.editedDraft,
      tags: entry.tags,
      summary: entry.summary,
      dominant_emotion: entry.dominantEmotion,
    }
    const result = await saveFullEntry(entry)
    expect(result.merged).toBe(true)
    expect(result.appended).toBe(false)
    const payload = db.upserts[0].payload
    for (const col of ['events', 'challenges', 'gratitude', 'freeform', 'ai_draft', 'edited_draft'] as const) {
      expect((payload[col] as string).trimEnd(), col).toBe(((db.existing as Record<string, string>)[col] ?? '').trimEnd())
    }
  })

  it('追記するとき、前の行に要約・感情が無ければ今回のものを入れる', async () => {
    db.existing = { ...wordedRow, summary: null, dominant_emotion: '' }
    await saveFullEntry(entry)
    expect(db.upserts[0].payload.summary).toBe('今回の要約')
    expect(db.upserts[0].payload.dominant_emotion).toBe('疲労')
  })

  it('既存の行を読むときは、追記に使うすべての列と要約・感情を読む', async () => {
    db.existing = wordedRow
    await saveFullEntry(entry)

    const cols = db.selects[0].split(',').map((c) => c.trim())
    for (const col of [...Object.keys(STORED_COLUMNS), 'summary', 'dominant_emotion']) {
      expect(cols, col).toContain(col)
    }
  })

  it('読み込み・保存に失敗したら例外にする（黙って上書きしない）', async () => {
    db.readError = { message: 'read failed' }
    await expect(saveFullEntry(entry)).rejects.toThrow('read failed')
    expect(db.upserts).toHaveLength(0)

    fake.reset()
    db.upsertError = { message: 'write failed' }
    await expect(saveFullEntry(entry)).rejects.toThrow('write failed')
  })

  it('ログインしていなければ保存しない', async () => {
    db.user = null
    await expect(saveFullEntry(entry)).rejects.toThrow('Unauthorized')
    expect(db.upserts).toHaveLength(0)
  })
})

describe('hasEntryWithWords', () => {
  it('その日に言葉のある行があれば true', async () => {
    db.existing = wordedRow
    await expect(hasEntryWithWords(DATE)).resolves.toBe(true)
    expect(db.eqs).toEqual([
      ['user_id', 'user-1'],
      ['entry_date', DATE],
    ])
  })

  it('行が無い・気分だけの行なら false', async () => {
    await expect(hasEntryWithWords(DATE)).resolves.toBe(false)
    db.existing = moodOnlyRow
    await expect(hasEntryWithWords(DATE)).resolves.toBe(false)
  })

  it('読み込みに失敗したら例外にする', async () => {
    db.readError = { message: 'read failed' }
    await expect(hasEntryWithWords(DATE)).rejects.toThrow('read failed')
  })
})

describe('refreshEntryMeta', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('AI が使えず空の結果（200）なら、何も書かずに null（前の要約・タグを消さない）', async () => {
    post.mockResolvedValue({ tags: [], summary: '', dominantEmotion: '' })
    await expect(refreshEntryMeta('entry-1', '本文')).resolves.toBeNull()
    expect(db.updates).toHaveLength(0)
  })

  it('項目が欠けた・空白だけの結果も「作れなかった」とみなす', async () => {
    post.mockResolvedValue({})
    await expect(refreshEntryMeta('entry-1', '本文')).resolves.toBeNull()
    post.mockResolvedValue({ summary: '  ', dominantEmotion: '\n' })
    await expect(refreshEntryMeta('entry-1', '本文')).resolves.toBeNull()
    expect(db.updates).toHaveLength(0)
  })

  it('作れた項目だけを書く（要約だけなら要約だけ）', async () => {
    post.mockResolvedValue({ tags: [], summary: ' 会議の日 ', dominantEmotion: '' })
    await expect(refreshEntryMeta('entry-1', '本文')).resolves.toEqual({
      tags: null,
      summary: '会議の日',
      dominantEmotion: null,
    })
    expect(db.updates).toEqual([{ payload: { summary: '会議の日' }, col: 'id', val: 'entry-1' }])
  })

  it('すべて作れたら、タグ・要約・感情を書く', async () => {
    post.mockResolvedValue({ tags: ['仕事', '疲れ'], summary: '会議の日', dominantEmotion: '疲労' })
    await expect(refreshEntryMeta('entry-1', '本文')).resolves.toEqual({
      tags: ['仕事', '疲れ'],
      summary: '会議の日',
      dominantEmotion: '疲労',
    })
    expect(db.updates).toEqual([
      { payload: { tags: ['仕事', '疲れ'], summary: '会議の日', dominant_emotion: '疲労' }, col: 'id', val: 'entry-1' },
    ])
    expect(post).toHaveBeenCalledWith('/api/draft-meta', { draft: '本文' }, { retry: false })
  })

  it('API が失敗したら null で、何も書かない（本文は保存済み）', async () => {
    post.mockRejectedValue(new Error('500'))
    await expect(refreshEntryMeta('entry-1', '本文')).resolves.toBeNull()
    expect(db.updates).toHaveLength(0)
  })

  it('書き込みに失敗しても例外にせず null', async () => {
    post.mockResolvedValue({ tags: ['仕事'], summary: '会議の日', dominantEmotion: '疲労' })
    db.updateError = { message: 'update failed' }
    await expect(refreshEntryMeta('entry-1', '本文')).resolves.toBeNull()
  })

  it('追記で長くなった本文は、API の上限に収めて送る', async () => {
    post.mockResolvedValue({ tags: ['仕事'], summary: '長い一日', dominantEmotion: '疲労' })
    const long = `始まり。${'あ'.repeat(META_INPUT_LIMIT * 2)}終わり。`
    await refreshEntryMeta('entry-1', long)

    expect(post).toHaveBeenCalledTimes(1)
    const sent = (post.mock.calls[0][1] as { draft: string }).draft
    expect(sent.length).toBeLessThanOrEqual(META_INPUT_LIMIT)
    expect(sent).toBe(metaExcerpt(long))
    expect(sent.startsWith('始まり。')).toBe(true)
    expect(sent.endsWith('終わり。')).toBe(true)
  })
})
