// 日記の本文を Notion の段落ブロックにする（純粋関数）。
// Notion の rich_text は1つ2000文字まで。以前は2000文字で切り捨てていたため、
// 同じ日に追記して長くなった日記の後半が Notion に届かなかった。

/** 段落ブロック1つに入れられる文字数（Notion の rich_text.content の上限） */
export const NOTION_TEXT_LIMIT = 2000
/** 1回のリクエストで追加できる子ブロックの上限（これを超える分は、何回かに分けて追加する） */
export const NOTION_MAX_BLOCKS = 100

/**
 * 本文を上限に収まる塊に分ける。上限以内ならそのまま1つ（これまでと同じ見た目）。
 * 超えるときは段落（空行）の切れ目で分け、それでも長い段落は文字の途中で分ける（絵文字などは割らない）。
 */
export function splitForNotion(text: string, limit: number = NOTION_TEXT_LIMIT): string[] {
  if (text.length <= limit) return [text]
  const chunks: string[] = []
  let current = ''
  const flush = () => {
    if (current) chunks.push(current)
    current = ''
  }
  for (const paragraph of text.split(/\n{2,}/)) {
    const joined = current ? `${current}\n\n${paragraph}` : paragraph
    if (joined.length <= limit) {
      current = joined
      continue
    }
    flush()
    if (paragraph.length <= limit) {
      current = paragraph
      continue
    }
    for (const ch of paragraph) {
      if (current.length + ch.length > limit) flush()
      current += ch
    }
  }
  flush()
  return chunks
}

/** ブロックを、1回のリクエストで送れる数ずつに分ける（長い日記も切り捨てずに全部送るため） */
export function inBatches<T>(items: T[], size: number = NOTION_MAX_BLOCKS): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** 本文を Notion の段落ブロックの配列にする */
export function toNotionParagraphs(text: string) {
  return splitForNotion(text).map((content) => ({
    object: 'block' as const,
    type: 'paragraph' as const,
    paragraph: { rich_text: [{ type: 'text' as const, text: { content } }] },
  }))
}
