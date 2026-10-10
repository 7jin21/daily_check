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

/**
 * 自由メモ（最初の印より前）と、それ以降（ふりかえり・あとからの一言）に分ける。
 * どちらも保存されている文字列をそのまま切り出すだけで、組み直さない（本人の文字を並べ替えない）。
 */
export function splitFreeformMemo(raw: string | null | undefined): { memo: string; rest: string } {
  const s = raw ?? ''
  const first = s.search(/【(ふりかえり|あとから \d{4}-\d{2}-\d{2})】/)
  return first < 0 ? { memo: s, rest: '' } : { memo: s.slice(0, first), rest: s.slice(first) }
}

/** 自由メモに、AI 内省ガイドの問いと答えを畳んだ文字列を作る（保存用。メモは書いたまま残す） */
export function withReflection(memo: string, question: string, answer: string): string {
  if (!answer.trim()) return memo
  return `${memo ? `${memo}\n\n` : ''}【ふりかえり】${question}\n→ ${answer}`
}

/** 当時の本文は変えずに、末尾へ「今の一言」を足す */
export function appendLaterNote(raw: string | null | undefined, date: string, text: string): string {
  const base = (raw ?? '').trimEnd()
  return `${base ? `${base}\n\n` : ''}【あとから ${date}】${text.trim()}`
}
