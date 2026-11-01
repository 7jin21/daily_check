'use client'

import { useState } from 'react'
import { composeReflectionAnswer } from '@/lib/freeform'
import { hapticTap } from '@/lib/haptics'
import PhraseLite from '@/components/ui/PhraseLite'
import { CheckIcon, PenIcon } from '@/components/ui/icons'
import './checkin.css'

interface ReflectionQuestionProps {
  question: string
  options: string[]
  onSubmit: (answer: string) => void
  onSkip: () => void
}

// AIが入力を読んで投げる「内省を1つだけ促す問い」。
// 選択肢タップだけでも進めるし、一言足してもよい。スキップも可能。
export default function ReflectionQuestion({
  question,
  options,
  onSubmit,
  onSkip,
}: ReflectionQuestionProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const canSubmit = selected !== null || note.trim().length > 0

  const handleSubmit = () => {
    const answer = composeReflectionAnswer(selected, note)
    // 「どれも近くない」だけを選んだときは答えなし（スキップと同じ）。本文に「どれも近くない」と書かない
    if (answer) onSubmit(answer)
    else onSkip()
  }

  return (
    <div className="ck-page animate-fade-in" style={{ paddingTop: 24 }}>
      <p className="label-ui mb-3">清書の前に、ひとつだけ</p>
      <h1 className="font-mincho text-[1.375rem] font-semibold leading-relaxed tracking-wide text-[var(--foreground)]">
        <PhraseLite text={question} />
      </h1>
      <p className="mt-2 mb-5 text-[0.8125rem] text-[var(--muted)] font-ui">近いものがあれば選んでください（選ばなくても大丈夫です）</p>

      <div className="flex flex-col gap-2.5 mb-5" role="radiogroup" aria-label={question}>
        {options.map((opt) => {
          const active = selected === opt
          return (
            <button
              key={opt}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                hapticTap()
                setSelected(active ? null : opt)
              }}
              className="ck-reflect-option"
            >
              <span className="ck-radio" aria-hidden="true">
                {active && <CheckIcon size={12} strokeWidth={2.2} />}
              </span>
              <PhraseLite text={opt} />
            </button>
          )
        })}
      </div>

      <div className="mb-2">
        <label htmlFor="ck-reflect-note" className="ck-field-label block">
          ひとこと足す（任意）
        </label>
        <textarea
          id="ck-reflect-note"
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 200))}
          rows={2}
          placeholder="例：内容は納得しているけど、前提を確認されなかったのが嫌だった"
          className="ck-textarea"
          style={{ paddingBottom: 16 }}
        />
      </div>

      <div className="flex-1" />

      <div className="ck-actions space-y-2">
        <button type="button" onClick={handleSubmit} disabled={!canSubmit} className="btn btn-primary btn-block">
          {canSubmit ? (
            <>
              <PenIcon size={18} />
              この答えも入れて清書する
            </>
          ) : (
            '選ぶか、ひとこと書いてください'
          )}
        </button>
        <button type="button" onClick={onSkip} className="btn btn-secondary btn-block">
          答えずに清書する
        </button>
      </div>
    </div>
  )
}
