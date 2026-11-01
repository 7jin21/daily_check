// diary_entries.freeform には、自由メモのあとに次の印つきの段落が畳まれている（DB の列は増やさない方針）:
//   【ふりかえり】問い\n→ 答え        … チェックイン時の AI 内省ガイドへの回答
//   【あとから YYYY-MM-DD】一言        … 後日、その日の日記に添えた「今の一言」
// 表示ではこれを分けて見せる。

export interface FreeformParts {
  memo: string
  reflections: { question: string; answer: string }[]
  laterNotes: { date: string; text: string }[]
}

// 印として扱うのは、欄の先頭か空行の直後にあるものだけ（アプリが書く印はいつもこの位置にある）。
// 本人が文の途中に【ふりかえり】などと書いても、印とは見なさない（文を切ったり並べ替えたりしない）
const MARK = /(^|\n\n)【(ふりかえり|あとから (\d{4}-\d{2}-\d{2}))】/g

export function parseFreeform(raw: string | null | undefined): FreeformParts {
  const s = raw ?? ''
  const re = new RegExp(MARK.source, 'g')
  const marks: { index: number; end: number; later: boolean; date: string }[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) {
    marks.push({ index: m.index + m[1].length, end: re.lastIndex, later: m[2] !== 'ふりかえり', date: m[3] ?? '' })
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
  const m = new RegExp(MARK.source).exec(s)
  if (!m) return { memo: s, rest: '' }
  const first = m.index + m[1].length
  return { memo: s.slice(0, first), rest: s.slice(first) }
}

/** 内省の問いに必ず付ける「どれも近くない」（候補を断るための選択肢。本人の答えの言葉としては扱わない） */
export const REFLECTION_NONE_OPTION = 'どれも近くない'

/**
 * 選んだ選択肢と一言から、清書・保存に使う答え（「選択肢 — 一言」）を作る。
 * 「どれも近くない」は答えに入れない（一言があれば一言だけ。一言も無ければ空＝答えなし）。
 * 入れてしまうと、本人が書いていない「どれも近くない」が日記の本文やふりかえりに残る
 */
export function composeReflectionAnswer(selected: string | null, note: string): string {
  const parts: string[] = []
  if (selected && selected !== REFLECTION_NONE_OPTION) parts.push(selected)
  if (note.trim()) parts.push(note.trim())
  return parts.join(' — ')
}

/** 保存されている答えから「どれも近くない」を除く（以前の版で保存された答えのため。何も残らなければ空） */
export function cleanReflectionAnswer(answer: string): string {
  const a = answer.trim()
  if (a === REFLECTION_NONE_OPTION) return ''
  const prefix = `${REFLECTION_NONE_OPTION} — `
  return a.startsWith(prefix) ? a.slice(prefix.length).trim() : a
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
