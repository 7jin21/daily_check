interface TextPart {
  type: 'text'
  text: { content: string }
}

export interface NotionBodyBlock {
  object: 'block'
  type: 'paragraph'
  paragraph: { rich_text: TextPart[] }
}

/** Notion API の上限: text.content は 2000 文字まで、rich_text の要素と1回で足す children は 100 個まで */
const NOTION_TEXT_LIMIT = 2000
const NOTION_ARRAY_LIMIT = 100

const byteLength = (value: unknown) => Buffer.byteLength(JSON.stringify(value), 'utf8')
const paragraph = (parts: TextPart[]): NotionBodyBlock => ({
  object: 'block',
  type: 'paragraph',
  paragraph: { rich_text: parts },
})

/** 本文を欠落させず、Notionの要素数・文字数・500KBリクエスト上限内に分ける。 */
export function notionBodyBatches(text: string): NotionBodyBlock[][] {
  const blocks: NotionBodyBlock[] = []
  let parts: TextPart[] = []
  for (let start = 0; start < text.length;) {
    let end = Math.min(start + NOTION_TEXT_LIMIT, text.length)
    // 絵文字などのサロゲートペアを2つのrich_textに分断しない。
    if (end < text.length && /[\uD800-\uDBFF]/.test(text[end - 1]) && /[\uDC00-\uDFFF]/.test(text[end])) end--
    const part: TextPart = { type: 'text', text: { content: text.slice(start, end) } }
    if (parts.length && (parts.length === NOTION_ARRAY_LIMIT || byteLength(paragraph([...parts, part])) > 350_000)) {
      blocks.push(paragraph(parts))
      parts = []
    }
    parts.push(part)
    start = end
  }
  if (parts.length) blocks.push(paragraph(parts))

  const batches: NotionBodyBlock[][] = []
  let batch: NotionBodyBlock[] = []
  for (const block of blocks) {
    // ページ作成時のプロパティ等にも余裕を残す。
    if (batch.length && (batch.length === NOTION_ARRAY_LIMIT || byteLength({ children: [...batch, block] }) > 400_000)) {
      batches.push(batch)
      batch = []
    }
    batch.push(block)
  }
  if (batch.length) batches.push(batch)
  return batches
}
