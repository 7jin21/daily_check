// 清書の「整え方」と、本人の言葉がどれだけ残っているかの比較（いずれも AI を使わない純粋関数）
import type { CheckinInput } from '@/stores/checkin'

export type DraftMode = 'raw' | 'tidy' | 'bullets'

export const DRAFT_MODES: { value: DraftMode; label: string; hint: string }[] = [
  { value: 'raw', label: '原文のまま', hint: '書いたメモをそのまま使います（AI は使いません）' },
  { value: 'tidy', label: '整える', hint: '言い回しはそのままに、つなぎと誤字だけ AI が整えます' },
  { value: 'bullets', label: '箇条書き', hint: '一文ずつ箇条書きに並べます（AI は使いません）' },
]

export interface ComposeInput extends CheckinInput {
  reflectionQ?: string
  reflectionA?: string
}

const FIELDS = ['events', 'challenges', 'gratitude', 'freeform'] as const

/** 内省の答え（「選択肢 — 一言」）を、本人の文として読める形にする */
function reflectionText(a?: string): string {
  return (a ?? '').trim().replace(/\s*—\s*/g, '。')
}

function blocks(input: ComposeInput): string[] {
  return [...FIELDS.map((f) => (input[f] ?? '').trim()), reflectionText(input.reflectionA)].filter(Boolean)
}

/** 原文のまま: 書いたメモを段落で並べるだけ */
export function composeRaw(input: ComposeInput): string {
  return blocks(input).join('\n\n')
}

/** 箇条書き: 行・句点ごとに「・」で並べる（文言は変えない） */
export function composeBullets(input: ComposeInput): string {
  const lines: string[] = []
  for (const block of blocks(input)) {
    for (const row of block.split(/\n+/)) {
      const line = row.replace(/^\s*[・\-*•●○]\s*/, '').trim()
      for (const sentence of line.split('。')) {
        const t = sentence.trim()
        if (t) lines.push(`・${t}`)
      }
    }
  }
  return lines.join('\n')
}

/** 入力が変わったかを判定するためのキー（気分だけの変更では清書し直さない） */
export function inputKey(input: ComposeInput): string {
  return JSON.stringify([
    ...FIELDS.map((f) => (input[f] ?? '').trim()),
    (input.reflectionQ ?? '').trim(),
    (input.reflectionA ?? '').trim(),
  ])
}

// 記号・空白は比較の対象外（句読点が足されただけで「AI が足した」と扱わない）
const SKIP = /[\s、。，．,.！!？?・「」『』（）()…—\-:：〜~→]/

export interface KeptAnalysis {
  /**
   * 清書の本文を「本人の言葉」と「AI が足した言葉」に分けたもの。
   * connector は、AI が足したもののうち文をつなぐだけの短いひらがな（「で」「が」など）。
   */
  segments: { text: string; added: boolean; connector: boolean }[]
  /** 清書の本文のうち、本人の言葉が占める割合（0〜1）。AI が足した言葉の分だけ下がる（つなぎの助詞は除く） */
  own: number
  /** 本人のメモのうち、清書に残っている割合（0〜1）。AI が言葉を足しても下がらない */
  kept: number
  /** AI が足した言葉の文字数（記号・空白・つなぎの助詞は数えない） */
  addedChars: number
}

/** 文をつなぐだけの、ひらがな2文字以内の足し（例:「で」「が」「って」）は AI の言葉として数えない */
const CONNECTOR = /^[ぁ-ゟ]{1,2}$/
const HIRAGANA = /^[ぁ-ゟ]$/

/** 記号・空白で区切った「句」ごとの文字列 */
function phrasesOf(chars: string[]): string[][] {
  const out: string[][] = []
  let cur: string[] = []
  for (const c of chars) {
    if (SKIP.test(c)) {
      if (cur.length) out.push(cur)
      cur = []
    } else cur.push(c)
  }
  if (cur.length) out.push(cur)
  return out
}

/**
 * source（突き合わせる元の文）の言葉が、清書のどの文字に現れているかを調べる。
 * source は句（記号・空白で区切った単位）ごとに3文字の並びに分け、2文字以下の句はそのまま単位にする
 * （句の切れ目をまたぐ並びは数えない。文と文の間に言葉が足されても減点しない）。
 */
function coverageOf(source: string, chars: string[], idx: number[], seq: string[]) {
  const grams = new Set<string>()
  const shorts: string[][] = []
  for (const p of phrasesOf(Array.from(source))) {
    if (p.length >= 3) for (let i = 0; i + 3 <= p.length; i++) grams.add(p[i] + p[i + 1] + p[i + 2])
    else shorts.push(p)
  }

  const covered = chars.map(() => false)
  const draftGrams = new Set<string>()
  for (let k = 0; k + 3 <= seq.length; k++) {
    const g = seq[k] + seq[k + 1] + seq[k + 2]
    draftGrams.add(g)
    if (grams.has(g)) covered[idx[k]] = covered[idx[k + 1]] = covered[idx[k + 2]] = true
  }
  // 句の途中に助詞が1文字だけ挟まった並び（「朝ジム」→「朝はジム」）も本人の言葉として拾う。
  // 挟まった1文字は覆わずに残すので、「つなぎ」として扱われる
  for (let k = 0; k + 4 <= seq.length; k++) {
    for (const gap of [1, 2]) {
      if (!HIRAGANA.test(seq[k + gap])) continue
      const picked = [0, 1, 2, 3].filter((j) => j !== gap)
      const g = picked.map((j) => seq[k + j]).join('')
      if (!grams.has(g)) continue
      draftGrams.add(g)
      for (const j of picked) covered[idx[k + j]] = true
    }
  }
  let shortHits = 0
  for (const unit of shorts) {
    let found = false
    for (let k = 0; k + unit.length <= seq.length; k++) {
      if (unit.every((c, j) => seq[k + j] === c)) {
        found = true
        unit.forEach((_, j) => (covered[idx[k + j]] = true))
      }
    }
    if (found) shortHits++
  }

  let gramHits = 0
  grams.forEach((g) => {
    if (draftGrams.has(g)) gramHits++
  })
  const total = grams.size + shorts.length
  /** source のうち清書に現れた割合 */
  const ratio = total ? (gramHits + shortHits) / total : 1
  return { covered, ratio }
}

/**
 * 本人のメモ（original）と清書（draft）を突き合わせる。
 * 清書側で、メモのどの単位にも当たらない文字を「AI が足した言葉」とみなす。
 *
 * aiSource（この下書きで AI が出した文章）を渡すと、メモに無い言葉のうち AI の文章にも無いもの
 * （下書き画面で本人が書き足した言葉）は本人の言葉として扱う。渡さなければ、メモに無い言葉はすべて AI の言葉。
 *
 * 2つの割合を返す:
 * - own: 清書のうち本人の言葉の割合。「あなたの言葉 ◯%」として見せる数字。AI が水増しすると下がる
 * - kept: メモのうち清書に残った割合。メモが削られていないかを見る補助の数字
 * （以前は kept だけを見せていたため、AI が文を大きく足しても 100% と表示されていた）
 */
export function analyzeKept(original: string, draft: string, aiSource?: string): KeptAnalysis {
  const chars = Array.from(draft)
  const idx: number[] = []
  chars.forEach((c, i) => {
    if (!SKIP.test(c)) idx.push(i)
  })
  const seq = idx.map((i) => chars[i]) // 記号を除いた清書の文字の並び

  const memo = coverageOf(original, chars, idx, seq)
  const kept = memo.ratio
  const fromAi = aiSource === undefined ? null : coverageOf(aiSource, chars, idx, seq).covered
  // 記号・空白は最初から「本人側」に入れておく（句読点が足されただけで AI の言葉と扱わない）
  const covered = chars.map((c, i) => SKIP.test(c) || memo.covered[i] || (fromAi !== null && !fromAi[i]))

  const segments: KeptAnalysis['segments'] = []
  chars.forEach((c, i) => {
    const added = !covered[i]
    const last = segments[segments.length - 1]
    if (last && last.added === added) last.text += c
    else segments.push({ text: c, added, connector: false })
  })

  let addedChars = 0
  for (const s of segments) {
    if (!s.added) continue
    s.connector = CONNECTOR.test(s.text)
    if (!s.connector) addedChars += s.text.length
  }
  // 記号・空白は本人側に入れているので、added の区間は記号を含まない
  const own = seq.length ? Math.max(0, 1 - addedChars / seq.length) : 1

  return { segments, own, kept, addedChars }
}
