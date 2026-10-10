// diary_entries.freeform には、自由メモのあとに次の印つきの段落が畳まれている（DB の列は増やさない方針）:
//   【ふりかえり】問い\n→ 答え        … チェックイン時の AI 内省ガイドへの回答
//   【あとから YYYY-MM-DD】一言        … 後日、その日の日記に添えた「今の一言」
// 表示ではこれを分けて見せる。

export interface FreeformParts {
  memo: string
  reflections: { question: string; answer: string }[]
  laterNotes: { date: string; text: string }[]
}

export function parseFreeform(raw: string | null | undefined): FreeformParts {
  const s = raw ?? ''
  const re = /【(ふりかえり|あとから (\d{4}-\d{2}-\d{2}))】/g
  const marks: { index: number; end: number; later: boolean; date: string }[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) {
    marks.push({ index: m.index, end: re.lastIndex, later: m[1] !== 'ふりかえり', date: m[2] ?? '' })
  }
  const parts: FreeformParts = {
    memo: (marks.length ? s.slice(0, marks[0].index) : s).trim(),
    reflections: [],
    laterNotes: [],
  }
  marks.forEach((mk, i) => {
    const body = s.slice(mk.end, i + 1 < marks.length ? marks[i + 1].index : s.length).trim()
    if (!body) return
    if (mk.later) {
      parts.laterNotes.push({ date: mk.date, text: body })
    } else {
      const [question, ...rest] = body.split('\n→ ')
      parts.reflections.push({ question: question.trim(), answer: rest.join('\n→ ').trim() })
    }
  })
  return parts
}

/** 分けた部品を、保存する形（自由メモ → ふりかえり → あとからの一言）に戻す */
export function serializeFreeform(parts: FreeformParts): string {
  const blocks: string[] = []
  if (parts.memo.trim()) blocks.push(parts.memo.trim())
  for (const r of parts.reflections) {
    const q = r.question.trim()
    const a = r.answer.trim()
    if (!q && !a) continue
    blocks.push(a ? `【ふりかえり】${q}\n→ ${a}` : `【ふりかえり】${q}`)
  }
  for (const n of parts.laterNotes) {
    if (n.text.trim()) blocks.push(`【あとから ${n.date}】${n.text.trim()}`)
  }
  return blocks.join('\n\n')
}

/** 自由メモに、AI 内省ガイドの問いと答えを畳んだ文字列を作る（保存用） */
export function withReflection(memo: string, question: string, answer: string): string {
  if (!answer.trim()) return memo
  return serializeFreeform({ memo, reflections: [{ question, answer }], laterNotes: [] })
}

/** 当時の本文は変えずに、末尾へ「今の一言」を足す */
export function appendLaterNote(raw: string | null | undefined, date: string, text: string): string {
  const base = (raw ?? '').trimEnd()
  return `${base ? `${base}\n\n` : ''}【あとから ${date}】${text.trim()}`
}
