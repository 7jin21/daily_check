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
  /** 清書の本文を「本人の言葉」と「AI が足した言葉」に分けたもの */
  segments: { text: string; added: boolean }[]
  /** 本人のメモのうち、清書に残っている割合（0〜1） */
  kept: number
}

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
 * 本人のメモ（original）と清書（draft）を突き合わせる。
 * メモは句（記号・空白で区切った単位）ごとに3文字の並びに分け、2文字以下の句はそのまま単位にする
 * （句の切れ目をまたぐ並びは数えない。文と文の間に言葉が足されても、本人の言葉は減点しない）。
 * 清書側で、どの単位にも当たらない文字を「AI が足した言葉」とみなす。
 */
export function analyzeKept(original: string, draft: string): KeptAnalysis {
  const grams = new Set<string>()
  const shorts: string[][] = []
  for (const p of phrasesOf(Array.from(original))) {
    if (p.length >= 3) for (let i = 0; i + 3 <= p.length; i++) grams.add(p[i] + p[i + 1] + p[i + 2])
    else shorts.push(p)
  }

  const chars = Array.from(draft)
  const idx: number[] = []
  chars.forEach((c, i) => {
    if (!SKIP.test(c)) idx.push(i)
  })
  const seq = idx.map((i) => chars[i]) // 記号を除いた清書の文字の並び

  // 記号・空白は最初から「本人側」に入れておく（句読点が足されただけで AI の言葉と扱わない）
  const covered = chars.map((c) => SKIP.test(c))
  const draftGrams = new Set<string>()
  for (let k = 0; k + 3 <= seq.length; k++) {
    const g = seq[k] + seq[k + 1] + seq[k + 2]
    draftGrams.add(g)
    if (grams.has(g)) covered[idx[k]] = covered[idx[k + 1]] = covered[idx[k + 2]] = true
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
  const kept = total ? (gramHits + shortHits) / total : 1

  const segments: KeptAnalysis['segments'] = []
  chars.forEach((c, i) => {
    const added = !covered[i]
    const last = segments[segments.length - 1]
    if (last && last.added === added) last.text += c
    else segments.push({ text: c, added })
  })
  return { segments, kept }
}
