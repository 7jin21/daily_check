import { describe, expect, it } from 'vitest'
import {
  appendText,
  hasWords,
  MAX_MERGED_TAGS,
  mergeEntryText,
  type IncomingEntryText,
  type StoredEntryText,
} from '@/lib/entry-merge'
import { parseFreeform } from '@/lib/freeform'

const emptyStored: StoredEntryText = {
  events: null,
  challenges: null,
  gratitude: null,
  freeform: null,
  ai_draft: null,
  edited_draft: null,
  tags: null,
}

const emptyIncoming: IncomingEntryText = {
  events: '',
  challenges: '',
  gratitude: '',
  freeform: '',
  aiDraft: '',
  editedDraft: '',
  tags: [],
}

describe('hasWords', () => {
  it('記録が無い・気分だけなら false', () => {
    expect(hasWords(null)).toBe(false)
    expect(hasWords(undefined)).toBe(false)
    expect(hasWords({})).toBe(false)
    expect(hasWords(emptyStored)).toBe(false)
    expect(hasWords({ ...emptyStored, events: '   ', freeform: '\n' })).toBe(false)
  })

  it('タグだけでは言葉があるとみなさない', () => {
    expect(hasWords({ ...emptyStored, tags: ['仕事'] })).toBe(false)
  })

  it('どれか1つの欄に言葉があれば true', () => {
    for (const col of ['events', 'challenges', 'gratitude', 'freeform', 'ai_draft', 'edited_draft'] as const) {
      expect(hasWords({ ...emptyStored, [col]: '会議' })).toBe(true)
    }
  })
})

describe('appendText', () => {
  it('前が空なら新しい言葉だけ、新しいのが空なら前の言葉だけ', () => {
    expect(appendText(null, '新しい', '\n')).toBe('新しい')
    expect(appendText('', ' 新しい ', '\n')).toBe('新しい')
    expect(appendText('前', null, '\n')).toBe('前')
    expect(appendText(' 前 ', '  ', '\n')).toBe('前')
    expect(appendText(undefined, undefined, '\n')).toBe('')
  })

  it('前の言葉のあとに区切りをはさんで足す', () => {
    expect(appendText('朝ジム', '夜ラーメン', '\n')).toBe('朝ジム\n夜ラーメン')
    expect(appendText(' 前の本文 ', ' 新しい本文 ', '\n\n')).toBe('前の本文\n\n新しい本文')
  })

  it('同じ内容・すでに含まれている内容は足さない', () => {
    expect(appendText('会議で疲れた', '会議で疲れた', '\n')).toBe('会議で疲れた')
    expect(appendText('会議で疲れた', ' 会議で疲れた\n', '\n')).toBe('会議で疲れた')
    expect(appendText('朝ジム\n夜ラーメン', '夜ラーメン', '\n')).toBe('朝ジム\n夜ラーメン')
  })

  it('新しい方が前の言葉を含む場合は、前の言葉を消さずに足す', () => {
    expect(appendText('疲れた', '会議で疲れた', '\n')).toBe('疲れた\n会議で疲れた')
  })
})

describe('mergeEntryText', () => {
  const existing: StoredEntryText = {
    events: '朝ジム',
    challenges: null,
    gratitude: '友達',
    freeform: '前のメモ\n\n【ふりかえり】Q1\n→ A1\n\n【あとから 2026-10-12】あとの一言',
    ai_draft: '前の清書',
    edited_draft: '前の編集',
    tags: ['仕事', '運動'],
  }
  const incoming: IncomingEntryText = {
    events: '夜ラーメン',
    challenges: '眠い',
    gratitude: '友達',
    freeform: '新しいメモ\n\n【ふりかえり】Q1\n→ A1\n\n【ふりかえり】Q2\n→ A2',
    aiDraft: '新しい清書',
    editedDraft: '新しい編集',
    tags: ['運動', '食事'],
  }

  it('前の言葉を消さずに、新しい言葉を追記する', () => {
    expect(mergeEntryText(existing, incoming)).toEqual({
      events: '朝ジム\n夜ラーメン',
      challenges: '眠い',
      gratitude: '友達',
      freeform:
        '前のメモ\n新しいメモ\n\n【ふりかえり】Q1\n→ A1\n\n【ふりかえり】Q2\n→ A2\n\n【あとから 2026-10-12】あとの一言',
      ai_draft: '前の清書\n\n新しい清書',
      edited_draft: '前の編集\n\n新しい編集',
      tags: ['仕事', '運動', '食事'],
    })
  })

  it('ふりかえりは重複なしですべて残し、あとからの一言も残す', () => {
    const merged = parseFreeform(mergeEntryText(existing, incoming).freeform)
    expect(merged.reflections).toEqual([
      { question: 'Q1', answer: 'A1' },
      { question: 'Q2', answer: 'A2' },
    ])
    expect(merged.laterNotes).toEqual([{ date: '2026-10-12', text: 'あとの一言' }])
  })

  it('同じ問いでも答えが違えば両方残す', () => {
    const merged = mergeEntryText(
      { ...emptyStored, freeform: '【ふりかえり】Q\n→ 朝の答え' },
      { ...emptyIncoming, freeform: '【ふりかえり】Q\n→ 夜の答え' }
    )
    expect(parseFreeform(merged.freeform).reflections).toEqual([
      { question: 'Q', answer: '朝の答え' },
      { question: 'Q', answer: '夜の答え' },
    ])
  })

  it('新しい側のあとからの一言も残す', () => {
    const merged = mergeEntryText(
      { ...emptyStored, freeform: 'メモ\n\n【あとから 2026-10-12】一つ目' },
      { ...emptyIncoming, freeform: '【あとから 2026-10-13】二つ目' }
    )
    expect(parseFreeform(merged.freeform)).toEqual({
      memo: 'メモ',
      reflections: [],
      laterNotes: [
        { date: '2026-10-12', text: '一つ目' },
        { date: '2026-10-13', text: '二つ目' },
      ],
    })
  })

  it('前の本文が edited_draft にしか無くても、清書・編集の両方に残す', () => {
    const merged = mergeEntryText(
      { ...emptyStored, edited_draft: '前の本文' },
      { ...emptyIncoming, aiDraft: '新しい清書', editedDraft: '新しい編集' }
    )
    expect(merged.ai_draft).toBe('前の本文\n\n新しい清書')
    expect(merged.edited_draft).toBe('前の本文\n\n新しい編集')
  })

  it('前の本文が ai_draft にしか無くても、清書・編集の両方に残す', () => {
    const merged = mergeEntryText(
      { ...emptyStored, ai_draft: '前の清書', edited_draft: '  ' },
      { ...emptyIncoming, aiDraft: '新しい清書', editedDraft: '新しい編集' }
    )
    expect(merged.ai_draft).toBe('前の清書\n\n新しい清書')
    expect(merged.edited_draft).toBe('前の清書\n\n新しい編集')
  })

  it('タグは重複なし・前の順のまま・上限まで', () => {
    const before = ['a', 'b', 'c', 'd', 'e', 'f']
    const after = ['b', ' g ', '', 'h', 'i', 'j']
    const merged = mergeEntryText({ ...emptyStored, tags: before }, { ...emptyIncoming, tags: after })
    expect(MAX_MERGED_TAGS).toBe(8)
    expect(merged.tags).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'])
  })

  it('壊れたタグ（文字列でない）は捨てる', () => {
    const merged = mergeEntryText(
      { ...emptyStored, tags: ['仕事', null, 3] as unknown as string[] },
      { ...emptyIncoming, tags: ['仕事'] }
    )
    expect(merged.tags).toEqual(['仕事'])
  })

  it('前の記録に言葉が無ければ、新しい内容がそのまま入る', () => {
    expect(mergeEntryText(emptyStored, incoming)).toEqual({
      events: '夜ラーメン',
      challenges: '眠い',
      gratitude: '友達',
      freeform: '新しいメモ\n\n【ふりかえり】Q1\n→ A1\n\n【ふりかえり】Q2\n→ A2',
      ai_draft: '新しい清書',
      edited_draft: '新しい編集',
      tags: ['運動', '食事'],
    })
  })

  it('同じ内容を2回保存しても重ならない', () => {
    const once = mergeEntryText(emptyStored, incoming)
    const twice = mergeEntryText({ ...once }, incoming)
    expect(twice).toEqual(once)
  })
})
