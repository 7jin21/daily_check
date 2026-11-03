import { Fragment } from 'react'

/**
 * 文節の切れ目にだけ <wbr> を入れて並べる（Wbr・Phrase・PhraseLite で共通。違うのは分け方だけ）。
 * hooks を使わないので、サーバーでもブラウザでも描ける。
 */
export function PhraseSpan({ parts, className = '' }: { parts: string[]; className?: string }) {
  return (
    <span className={`phrase ${className}`.trim()}>
      {parts.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && <wbr />}
          {p}
        </Fragment>
      ))}
    </span>
  )
}

// 決まった文言を、こちらで決めた文節の切れ目（「|」）でだけ折り返す。
// BudouX（components/ui/Phrase.tsx）を読み込まずに済むので、画面の部品の固定文言にはこちらを使う。
// 例: <Wbr text="気分は月の満ち欠けで、|エネルギーは水の高さで|映します" />
export default function Wbr({ text, className }: { text: string; className?: string }) {
  return <PhraseSpan parts={text.split('|')} className={className} />
}
