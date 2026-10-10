import { describe, expect, it } from 'vitest'
import { NOTION_MAX_BLOCKS, NOTION_TEXT_LIMIT, inBatches, splitForNotion, toNotionParagraphs } from '@/lib/notion-blocks'

describe('splitForNotion', () => {
  it('上限以内ならそのまま1つ（改行もそのまま）', () => {
    const text = '朝はジム。\n\n夜はラーメン。'
    expect(splitForNotion(text)).toEqual([text])
  })

  it('上限を超えたら段落の切れ目で分け、どの塊も上限以内', () => {
    const para = 'あ'.repeat(800)
    const text = [para, para, para].join('\n\n')
    const chunks = splitForNotion(text)
    expect(chunks).toEqual([`${para}\n\n${para}`, para])
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(NOTION_TEXT_LIMIT)
  })

  it('1段落が上限より長ければ途中で分け、文字は失わない', () => {
    const text = 'い'.repeat(NOTION_TEXT_LIMIT * 2 + 10)
    const chunks = splitForNotion(text)
    expect(chunks.map((c) => c.length)).toEqual([NOTION_TEXT_LIMIT, NOTION_TEXT_LIMIT, 10])
    expect(chunks.join('')).toBe(text)
  })

  it('絵文字（サロゲートペア）を途中で割らない', () => {
    const text = '😄'.repeat(1500) // UTF-16 で 3000
    const chunks = splitForNotion(text)
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(NOTION_TEXT_LIMIT)
      expect(c).not.toMatch(/[\uD800-\uDBFF]$/)
    }
    expect(chunks.join('')).toBe(text)
  })

  it('段落ごとの本文の文字はすべて残る（空行の数だけが段落の切れ目に置き換わる）', () => {
    const paras = Array.from({ length: 12 }, (_, i) => `${i}:${'う'.repeat(300)}`)
    const chunks = splitForNotion(paras.join('\n\n'))
    expect(chunks.join('\n\n')).toBe(paras.join('\n\n'))
  })

  it('1回に送れる数（100ブロック）を超えても切り捨てない', () => {
    const text = 'え'.repeat(NOTION_TEXT_LIMIT * (NOTION_MAX_BLOCKS + 5))
    const chunks = splitForNotion(text)
    expect(chunks).toHaveLength(NOTION_MAX_BLOCKS + 5)
    expect(chunks.join('')).toBe(text)
  })
})

describe('inBatches', () => {
  it('100件ずつに分ける（最後は端数）', () => {
    const items = Array.from({ length: 205 }, (_, i) => i)
    expect(inBatches(items).map((b) => b.length)).toEqual([100, 100, 5])
    expect(inBatches(items).flat()).toEqual(items)
    expect(inBatches([])).toEqual([])
  })
})

describe('toNotionParagraphs', () => {
  it('段落ブロックの形にする', () => {
    expect(toNotionParagraphs('こんにちは')).toEqual([
      { object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: 'こんにちは' } }] } },
    ])
  })
})
