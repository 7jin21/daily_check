import { Fragment } from 'react'

// 画面の部品（ブラウザ）で使う、軽い文節分け。
// BudouX（components/ui/Phrase.tsx）は全言語のモデルごとブラウザに入って読み込みが約 120KB 増えるため、
// ブラウザではブラウザに入っている単語分け（Intl.Segmenter）を使い、ひらがな・句読点だけの切れ端を前の語へつなげて、
// 助詞や活用の前で行が折れないようにする（「前提を｜確認してほしかった」）。BudouX より切れ目は少し粗いが、崩れはしない。
// Intl.Segmenter が無い環境では分けずにそのまま返す（ふつうの折り返しになるだけ）。
// サーバーとブラウザで結果がずれる可能性があるので、サーバーで描く文には使わない（そちらは Phrase を使う）。

/** つなげる切れ端: ひらがな・長音・句読点・閉じかっこだけのもの */
const TAIL = /^[\p{Script=Hiragana}ー、。，．！？!?」』）)…・\s]+$/u
/** 次の語に付ける切れ端: 開きかっこだけのもの */
const OPEN = /^[「『（(]+$/u
/** ここで文が区切れている（次のひらがなは新しいかたまりにする） */
const PAUSE = /[、。，．！？!?]$/

type SegmenterLike = { segment: (s: string) => Iterable<{ segment: string }> }
let segmenter: SegmenterLike | null | undefined

function getSegmenter(): SegmenterLike | null {
  if (segmenter !== undefined) return segmenter
  const Seg = (Intl as unknown as { Segmenter?: new (locale: string, o: { granularity: 'word' }) => SegmenterLike }).Segmenter
  segmenter = Seg ? new Seg('ja', { granularity: 'word' }) : null
  return segmenter
}

export function phrasesLite(text: string): string[] {
  if (!text) return []
  const seg = getSegmenter()
  if (!seg) return [text]
  const out: string[] = []
  let open = ''
  for (const { segment } of seg.segment(text)) {
    if (OPEN.test(segment)) {
      open += segment
      continue
    }
    const last = out[out.length - 1]
    if (last !== undefined && !open && TAIL.test(segment) && !(PAUSE.test(last) && /^\p{Script=Hiragana}/u.test(segment))) {
      out[out.length - 1] = last + segment
    } else {
      out.push(open + segment)
      open = ''
    }
  }
  if (open) out.push(open)
  return out
}

export default function PhraseLite({ text, className = '' }: { text: string; className?: string }) {
  return (
    <span className={`phrase ${className}`.trim()}>
      {phrasesLite(text).map((c, i) => (
        <Fragment key={i}>
          {i > 0 && <wbr />}
          {c}
        </Fragment>
      ))}
    </span>
  )
}
