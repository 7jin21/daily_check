import 'server-only'
import { Fragment } from 'react'
import { Parser, jaModel } from 'budoux'

// 文節の切れ目でだけ改行する（Google の BudouX で文節に分け、切れ目に <wbr> を入れる）。
// 「前提を／確認してほしかった」のように、ことばの途中で行が折れるのを防ぐ。
// Chrome の word-break: auto-phrase は Safari では効かないため、iPhone でも効くこちらを使う。
// 見出し・一文の引用のような短い文に使う。長い本文に使うと行末がでこぼこになるので使わない。
// サーバーで描く部品専用（server-only）。BudouX は全言語のモデルごと入るため、ブラウザに送ると読み込みが約 120KB 増える。
// ブラウザで描く部品では、決まった文言は Wbr、AI の文など動く文は PhraseLite を使う。

let parser: Parser | null = null
const getParser = () => (parser ??= new Parser(jaModel))

export function phrases(text: string): string[] {
  if (!text) return []
  try {
    return getParser().parse(text)
  } catch {
    return [text]
  }
}

export default function Phrase({ text, className = '' }: { text: string; className?: string }) {
  const chunks = phrases(text)
  return (
    <span className={`phrase ${className}`.trim()}>
      {chunks.map((c, i) => (
        <Fragment key={i}>
          {i > 0 && <wbr />}
          {c}
        </Fragment>
      ))}
    </span>
  )
}
