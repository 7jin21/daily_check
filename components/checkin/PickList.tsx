'use client'

import { useState } from 'react'
import { hapticTap } from '@/lib/haptics'

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
  onInsert: (items: PickItem[]) => void
}

export default function PickList({ title, items, onInsert }: Props) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(items.map((i) => i.id)))
  const [done, setDone] = useState(false)

  if (items.length === 0) return null

  if (done) {
    return (
      <p className="text-xs text-[var(--muted)] px-1" role="status">
        ✓ {title}を「今日あったこと」に入れました。いらない行は消して大丈夫です。
      </p>
    )
  }

  const toggle = (id: string) => {
    hapticTap()
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
                  {on ? '✓' : ''}
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
          onInsert(items.filter((i) => selected.has(i.id)))
          setDone(true)
        }}
      >
        選んだ{selected.size}件を「今日あったこと」に入れる
      </button>
    </div>
  )
}
