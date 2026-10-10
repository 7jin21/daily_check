import { describe, expect, it } from 'vitest'
import {
  appendText,
  hasWords,
  MAX_MERGED_TAGS,
  META_INPUT_LIMIT,
  mergeEntryText,
  mergeFreeform,
  metaExcerpt,
  type IncomingEntryText,
  type StoredEntryText,
} from '@/lib/entry-merge'
import { parseFreeform, withReflection } from '@/lib/freeform'

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
    expect(appendText('', ' 新しい ', '\n')).toBe(' 新しい')
    expect(appendText('前', null, '\n')).toBe('前')
    expect(appendText(' 前 ', '  ', '\n')).toBe(' 前')
    expect(appendText(undefined, undefined, '\n')).toBe('')
  })

  it('前の言葉のあとに区切りをはさんで足す', () => {
    expect(appendText('朝ジム', '夜ラーメン', '\n')).toBe('朝ジム\n夜ラーメン')
    expect(appendText(' 前の本文 ', ' 新しい本文 ', '\n\n')).toBe(' 前の本文\n\n 新しい本文')
  })

  it('本人の字下げは残し、つなぎ目の空行と末尾の空白・改行だけ落とす', () => {
    expect(appendText('　朝はジム。\n', '\n\n　夜はラーメン。\n', '\n')).toBe('　朝はジム。\n　夜はラーメン。')
    // やり直しの判定は空白を除いて比べる
    expect(appendText('　朝はジム。\n', '朝はジム。', '\n')).toBe('　朝はジム。')
    expect(appendText('朝\n　夜', '　夜\n', '\n')).toBe('朝\n　夜')
  })

  it('同じ保存のやり直し（前の言葉そのもの）は足さない', () => {
    expect(appendText('会議で疲れた', '会議で疲れた', '\n')).toBe('会議で疲れた')
    expect(appendText('会議で疲れた', ' 会議で疲れた\n', '\n')).toBe('会議で疲れた')
  })

  it('前の言葉の末尾にすでに区切りつきで足してあれば足さない（追記のやり直し）', () => {
    expect(appendText('朝ジム\n夜ラーメン', '夜ラーメン', '\n')).toBe('朝ジム\n夜ラーメン')
    expect(appendText('前の本文\n\n新しい本文', '新しい本文', '\n\n')).toBe('前の本文\n\n新しい本文')
  })

  it('複数行の新しい言葉も、末尾に足してあればやり直しとみなす', () => {
    expect(appendText('前\n夜ラーメン\n眠い', '夜ラーメン\n眠い', '\n')).toBe('前\n夜ラーメン\n眠い')
    expect(appendText('前の本文\n\n一段落目\n\n二段落目', '一段落目\n\n二段落目', '\n\n')).toBe(
      '前の本文\n\n一段落目\n\n二段落目'
    )
  })

  it('前の文の一部と同じ短い言葉は、別のときの言葉として足す', () => {
    // 朝「会議で疲れた」・夜「疲れた」は別の気持ち。含まれているからと捨てると夜の言葉が消える
    expect(appendText('会議で疲れた', '疲れた', '\n')).toBe('会議で疲れた\n疲れた')
    expect(appendText('朝ジム\n夜ラーメン', '朝ジム', '\n')).toBe('朝ジム\n夜ラーメン\n朝ジム')
    expect(appendText('朝はジム', 'ジム', '\n')).toBe('朝はジム\nジム')
  })

  it('区切りが違えば、末尾が同じでもやり直しとみなさない', () => {
    // '\n\n' で足す欄では、1つの改行のあとの同じ言葉は別の行として書かれたもの
    expect(appendText('前\n新しい', '新しい', '\n\n')).toBe('前\n新しい\n\n新しい')
  })

  it('新しい方が前の言葉を含む場合は、前の言葉を消さずに足す', () => {
    expect(appendText('疲れた', '会議で疲れた', '\n')).toBe('疲れた\n会議で疲れた')
  })
})

describe('mergeFreeform', () => {
  it('新しいメモが無ければ、前の欄は空白・改行も含めて一字も変えない', () => {
    const before = '　今日は\n\n\n【ふりかえり】Q\n→ A\n'
    expect(mergeFreeform(before, '')).toBe(before)
    expect(mergeFreeform('メモ【ふりかえり】', null)).toBe('メモ【ふりかえり】')
    // 新しいふりかえりだけなら、前の欄はそのままで末尾に足す
    expect(mergeFreeform(before, '【ふりかえり】Q2\n→ B')).toBe('　今日は\n\n\n【ふりかえり】Q\n→ A\n\n【ふりかえり】Q2\n→ B')
  })

  it('新しいメモは前のメモのあと（ふりかえり・あとからの一言より前）に入れる', () => {
    expect(mergeFreeform('前のメモ\n\n【ふりかえり】Q1\n→ A1\n\n【あとから 2026-10-12】一言', '新しいメモ')).toBe(
      '前のメモ\n新しいメモ\n\n【ふりかえり】Q1\n→ A1\n\n【あとから 2026-10-12】一言'
    )
  })

  it('前のメモが無ければ、新しいメモを印より前に入れる', () => {
    expect(mergeFreeform('【あとから 2026-10-12】一言', '新しいメモ')).toBe('新しいメモ\n\n【あとから 2026-10-12】一言')
  })

  it('前のふりかえり・あとからの一言は、書かれたとおりの文字列で残す（組み直さない）', () => {
    // 空白・改行のくせや、問いの無い印もそのまま。parse → serialize すると変わってしまう形
    const rest = '【ふりかえり】  Q1 \n→  A1\n【あとから 2026-10-12】  一言\n\n\n【ふりかえり】\n\n【ふりかえり】Q0\n→ A0'
    const merged = mergeFreeform(`前のメモ\n\n${rest}`, withReflection('新しいメモ', 'Q2', 'A2'))
    expect(merged).toBe(`前のメモ\n新しいメモ\n\n${rest}\n\n【ふりかえり】Q2\n→ A2`)
    expect(merged.includes(rest)).toBe(true)
  })

  it('本人が書いた印に似た文字（中身の無い印）も、捨てずに並びのまま残す', () => {
    expect(mergeFreeform('メモ【ふりかえり】', '新しいメモ')).toBe('メモ\n新しいメモ\n\n【ふりかえり】')
    expect(parseFreeform('メモ【ふりかえり】').reflections).toEqual([]) // 部品として読むと消える形
  })

  it('あとからの一言の中に【ふりかえり】が入っていても、並べ替えずに残す', () => {
    const before = 'メモ\n\n【あとから 2026-10-12】一言【ふりかえり】が入った一言'
    expect(mergeFreeform(before, withReflection('新しいメモ', 'Q', 'A'))).toBe(
      'メモ\n新しいメモ\n\n【あとから 2026-10-12】一言【ふりかえり】が入った一言\n\n【ふりかえり】Q\n→ A'
    )
  })

  it('新しいふりかえりは末尾（前のあとからの一言のあと）に足す', () => {
    expect(mergeFreeform('メモ\n\n【あとから 2026-10-12】一言', '【ふりかえり】Q\n→ A')).toBe(
      'メモ\n\n【あとから 2026-10-12】一言\n\n【ふりかえり】Q\n→ A'
    )
  })

  it('同じ問いでも答えが違えば両方残す', () => {
    expect(mergeFreeform('【ふりかえり】Q\n→ 朝の答え', '【ふりかえり】Q\n→ 夜の答え')).toBe(
      '【ふりかえり】Q\n→ 朝の答え\n\n【ふりかえり】Q\n→ 夜の答え'
    )
  })

  it('同じ内容どうしなら変わらない（mergeFreeform(x, x) === x）', () => {
    for (const x of [
      'メモ',
      'メモ\n\n【ふりかえり】Q\n→ A',
      '【ふりかえり】Q\n→ A',
      'メモ\n2行目\n\n【ふりかえり】Q1\n→ A1\n\n【あとから 2026-10-12】一言\n\n【ふりかえり】Q2\n→ A2',
    ]) {
      expect(mergeFreeform(x, x), JSON.stringify(x)).toBe(x)
    }
  })

  it('同じ保存をやり直しても重ならない（追記したあとに同じ内容がもう一度来る）', () => {
    const cases: [string, string][] = [
      ['前のメモ\n\n【ふりかえり】Q1\n→ A1', withReflection('新しいメモ', 'Q2', 'A2')],
      ['前のメモ\n\n【あとから 2026-10-12】一言', '新しいメモ\n2行目'],
      ['前のメモ', '【ふりかえり】Q\n→ A'],
      ['【あとから 2026-10-12】一言', withReflection('新しいメモ', 'Q', 'A')],
      ['メモ【ふりかえり】', withReflection('新しいメモ', 'Q', 'A')],
    ]
    for (const [before, incoming] of cases) {
      const merged = mergeFreeform(before, incoming)
      expect(mergeFreeform(merged, incoming), JSON.stringify([before, incoming])).toBe(merged)
    }
  })

  it('どちらかが空なら、もう片方だけ', () => {
    expect(mergeFreeform(null, null)).toBe('')
    expect(mergeFreeform(undefined, '')).toBe('')
    expect(mergeFreeform('', 'メモ\n\n【ふりかえり】Q\n→ A')).toBe('メモ\n\n【ふりかえり】Q\n→ A')
    expect(mergeFreeform(null, '【ふりかえり】Q\n→ A')).toBe('【ふりかえり】Q\n→ A')
    expect(mergeFreeform('メモ\n\n【ふりかえり】Q\n→ A', '')).toBe('メモ\n\n【ふりかえり】Q\n→ A')
    expect(mergeFreeform('メモ\n\n【ふりかえり】Q\n→ A', '  \n')).toBe('メモ\n\n【ふりかえり】Q\n→ A')
    expect(mergeFreeform('  \n', 'メモ')).toBe('メモ')
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
  // 新しいチェックインの自由メモには、そのときのふりかえりだけが入る（withReflection の形）
  const incoming: IncomingEntryText = {
    events: '夜ラーメン',
    challenges: '眠い',
    gratitude: '友達',
    freeform: withReflection('新しいメモ', 'Q2', 'A2'),
    aiDraft: '新しい清書',
    editedDraft: '新しい編集',
    tags: ['運動', '食事'],
  }

  it('前の言葉を消さずに、新しい言葉を追記する', () => {
    expect(mergeEntryText(existing, incoming)).toEqual({
      events: '朝ジム\n夜ラーメン',
      challenges: '眠い',
      // 同じ言葉の短い欄は、別のときの言葉ではなくやり直しとみなす（まったく同じ文字列だけ）
      gratitude: '友達',
      freeform:
        '前のメモ\n新しいメモ\n\n【ふりかえり】Q1\n→ A1\n\n【あとから 2026-10-12】あとの一言\n\n【ふりかえり】Q2\n→ A2',
      ai_draft: '前の清書\n\n新しい清書',
      edited_draft: '前の編集\n\n新しい編集',
      tags: ['仕事', '運動', '食事'],
    })
  })

  it('ふりかえりもあとからの一言もすべて残す', () => {
    const merged = parseFreeform(mergeEntryText(existing, incoming).freeform)
    expect(merged.memo).toBe('前のメモ\n新しいメモ')
    expect(merged.reflections).toEqual([
      { question: 'Q1', answer: 'A1' },
      { question: 'Q2', answer: 'A2' },
    ])
    expect(merged.laterNotes).toEqual([{ date: '2026-10-12', text: 'あとの一言' }])
  })

  it('前の文の一部と同じ短い言葉（朝「会議で疲れた」・夜「疲れた」）も追記する', () => {
    const merged = mergeEntryText(
      { ...emptyStored, events: '会議で疲れた', challenges: '会議が長い', edited_draft: '今日は会議で疲れた。' },
      { ...emptyIncoming, events: '疲れた', challenges: '長い', editedDraft: '疲れた。' }
    )
    expect(merged.events).toBe('会議で疲れた\n疲れた')
    expect(merged.challenges).toBe('会議が長い\n長い')
    expect(merged.edited_draft).toBe('今日は会議で疲れた。\n\n疲れた。')
  })

  it('前の自由メモの一部と同じ短いメモも追記する', () => {
    const merged = mergeEntryText(
      { ...emptyStored, freeform: '会議で疲れた\n\n【ふりかえり】Q\n→ A' },
      { ...emptyIncoming, freeform: '疲れた' }
    )
    expect(merged.freeform).toBe('会議で疲れた\n疲れた\n\n【ふりかえり】Q\n→ A')
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
    expect(merged.freeform).toBe('メモ\n\n【あとから 2026-10-12】一つ目\n\n【あとから 2026-10-13】二つ目')
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
      freeform: '新しいメモ\n\n【ふりかえり】Q2\n→ A2',
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

  it('追記したあとに同じ保存をやり直しても重ならない', () => {
    const once = mergeEntryText(existing, incoming)
    const twice = mergeEntryText({ ...once }, incoming)
    expect(twice).toEqual(once)
  })
})

describe('metaExcerpt', () => {
  it('上限は /api/draft-meta と同じ 3000 文字', () => {
    expect(META_INPUT_LIMIT).toBe(3000)
  })

  it('上限以内ならそのまま返す', () => {
    expect(metaExcerpt('', 10)).toBe('')
    expect(metaExcerpt('短い本文', 10)).toBe('短い本文')
    expect(metaExcerpt('0123456789', 10)).toBe('0123456789')
    const exact = 'あ'.repeat(META_INPUT_LIMIT)
    expect(metaExcerpt(exact)).toBe(exact)
  })

  it('上限を超えたら、ちょうど上限の長さにする', () => {
    for (const limit of [10, 11, 100, META_INPUT_LIMIT]) {
      for (const extra of [1, 2, 7, 5000]) {
        const text = 'x'.repeat(limit + extra)
        expect(metaExcerpt(text, limit).length, `${limit}+${extra}`).toBe(limit)
      }
    }
    expect(metaExcerpt('あ'.repeat(META_INPUT_LIMIT + 1)).length).toBe(META_INPUT_LIMIT)
  })

  it('始まりと終わりを残し、間を「…」の行で省く', () => {
    const text = `始まりの段落。${'途中'.repeat(2000)}終わりの段落。`
    const out = metaExcerpt(text)
    expect(out.length).toBe(META_INPUT_LIMIT)
    expect(out.startsWith('始まりの段落。')).toBe(true)
    expect(out.endsWith('終わりの段落。')).toBe(true)
    expect(out).toContain('\n…\n')

    const [head, tail] = out.split('\n…\n')
    expect(text.startsWith(head)).toBe(true)
    expect(text.endsWith(tail)).toBe(true)
    // 始まりと終わりはほぼ半分ずつ
    expect(Math.abs(head.length - tail.length)).toBeLessThanOrEqual(1)
  })

  it('小さい上限でも始まりと終わりの文字を残す', () => {
    expect(metaExcerpt('0123456789abcdef', 9)).toBe('012\n…\ndef')
  })
})
