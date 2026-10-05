'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { MEMO_MAX_CHARS, todaysMemos, useMemoStore } from '@/stores/memos'
import VoiceInputButton from '@/components/ui/VoiceInputButton'

// 日中の「ひとこと」を時刻つきで残す。夜のチェックインで、残したいものを選んで日記に入れる。
export default function QuickMemo({ today }: { today: string }) {
  const memoState = useMemoStore()
  const [mounted, setMounted] = useState(false) // localStorage 由来の値はマウント後に出す（SSR とのずれ防止）
  const [text, setText] = useState('')
  useEffect(() => setMounted(true), [])

  const memos = mounted ? todaysMemos(memoState, today) : []

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    memoState.add(text)
    setText('')
  }

  return (
    <div>
      <form className="im-memo-form" onSubmit={submit}>
        <input
          className="im-memo-input"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MEMO_MAX_CHARS))}
          placeholder="いまの一言を残す"
          enterKeyHint="done"
          aria-label="今日のひとこと"
        />
        <VoiceInputButton onResult={(t) => setText((prev) => (prev ? `${prev} ${t}` : t).slice(0, MEMO_MAX_CHARS))} />
        <button type="submit" className="im-memo-add" disabled={!text.trim()}>
          残す
        </button>
      </form>
      {memos.length > 0 ? (
        <ul className="im-memo-list">
          {memos.map((m) => (
            <li key={m.id} className="im-memo-item">
              <span className="im-memo-time">{m.time}</span>
              <span className="im-memo-text">{m.text}</span>
              <button
                type="button"
                className="im-memo-del"
                aria-label={`「${m.text}」を消す`}
                onClick={() => memoState.remove(m.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="im-memo-empty">会議のこと、ふと思ったこと。夜の記録で、残したいものを選んで日記に入れられます。</p>
      )}
    </div>
  )
}
