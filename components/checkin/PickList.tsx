'use client'

import { useState } from 'react'
import { hapticTap } from '@/lib/haptics'
import { CheckIcon } from '@/components/ui/icons'

// 「今日のひとこと」や「今日の予定」から、日記に入れたいものだけを選んで挿入するリスト。
// 全部入れるのではなく、残したいものを本人が選ぶ（振り返りの入口にする）。

export interface PickItem {
  id: string
  label: string
  meta?: string // 時刻など
}

interface Props {
  title: string
  items: PickItem[]
  /** 「今日あったこと」の文字数の上限（入りきらなかったときの案内に使う） */
  maxChars: number
  /** 一部が入りきらなかったときに添える一言（例: メモは消えずに残る） */
  skippedNote?: string
  /** 選んだ項目を入れて、実際に入った件数を返す（上限に入らない項目は入れない） */
  onInsert: (items: PickItem[]) => number
}

export default function PickList({ title, items, maxChars, skippedNote, onInsert }: Props) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(items.map((i) => i.id)))
  const [result, setResult] = useState<{ inserted: number; skipped: number } | null>(null)

  if (items.length === 0) return null

  // 入れたあと（1件でも入ったら一覧を閉じる。入らなかった分があれば、黙らずに伝える）
  if (result && result.inserted > 0) {
    return (
      <p className="flex gap-2 text-xs leading-relaxed text-[var(--muted)] px-1" role="status">
        <CheckIcon size={16} className="flex-none text-[var(--primary)] mt-px" />
        <span>
          {result.skipped === 0 ? (
            <>{title}を「今日あったこと」に入れました。いらない行は消して大丈夫です。</>
          ) : (
            <>
              {result.inserted}件を「今日あったこと」に入れました。{result.skipped}件は文字数の上限（{maxChars}字）に入りきらないため、入れていません。
              {skippedNote}
            </>
          )}
        </span>
      </p>
    )
  }

  const toggle = (id: string) => {
    hapticTap()
    setResult(null)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="pick">
      <div className="pick-head">
        <span className="pick-title">{title}</span>
        <span className="pick-count">
          {selected.size}/{items.length}
        </span>
      </div>
      <ul>
        {items.map((it) => {
          const on = selected.has(it.id)
          return (
            <li key={it.id}>
              <button type="button" className="pick-item" data-on={on} aria-pressed={on} onClick={() => toggle(it.id)}>
                <span className="pick-check" aria-hidden="true">
                  {on && <CheckIcon size={14} strokeWidth={2} />}
                </span>
                {it.meta && <span className="pick-meta">{it.meta}</span>}
                <span className="pick-label">{it.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <button
        type="button"
        className="pick-insert"
        disabled={selected.size === 0}
        onClick={() => {
          hapticTap()
          const picked = items.filter((i) => selected.has(i.id))
          const inserted = onInsert(picked)
          setResult({ inserted, skipped: picked.length - inserted })
        }}
      >
        選んだ{selected.size}件を「今日あったこと」に入れる
      </button>
      {result && result.inserted === 0 && (
        <p className="mt-2 text-xs px-1 text-[var(--danger)]" role="alert">
          「今日あったこと」が文字数の上限（{maxChars}字）に近いため、入れられませんでした。文章を短くするか、入れるものを減らしてください。
        </p>
      )}
    </div>
  )
}
