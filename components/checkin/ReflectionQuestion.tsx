'use client'

import { useState } from 'react'

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
    const parts: string[] = []
    if (selected) parts.push(selected)
    if (note.trim()) parts.push(note.trim())
    onSubmit(parts.join(' — '))
  }

  return (
    <div className="min-h-dvh flex flex-col px-4 pt-6 animate-fade-in">
      <div className="eyebrow mb-2">One more step</div>
      <h1 className="text-xl font-bold text-[var(--foreground)] leading-relaxed mb-1">
        {question}
      </h1>
      <p className="text-sm text-[var(--muted-2)] mb-5">近いものがあれば選んでください（任意）</p>

      <div className="flex flex-col gap-2.5 mb-5">
        {options.map((opt) => {
          const active = selected === opt
          return (
            <button
              key={opt}
              type="button"
              onClick={() => setSelected(active ? null : opt)}
              className={`w-full text-left px-4 py-3.5 rounded-2xl border transition-all active:scale-[0.98] ${
                active
                  ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--foreground)]'
                  : 'border-[var(--border)] text-[var(--foreground)]'
              }`}
            >
              {opt}
            </button>
          )
        })}
      </div>

      <div className="mb-2">
        <label className="block text-xs text-[var(--muted-2)] mb-1.5">ひとこと足す（任意）</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 200))}
          rows={2}
          placeholder="例：内容は納得しているけど、前提を確認されなかったのが嫌だった"
          className="w-full p-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] text-base resize-none focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
        />
      </div>

      <div className="flex-1" />

      <div className="pb-6 space-y-3">
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full py-4 rounded-full bg-[var(--accent)] text-[#f7f4ea] font-bold text-base disabled:opacity-30 active:scale-[0.99] transition-transform glow-sky"
        >
          この内容で日記を書く ✨
        </button>
        <button
          onClick={onSkip}
          type="button"
          className="w-full py-3 rounded-full border border-[var(--border)] text-[var(--muted)] text-sm active:scale-[0.99] transition-transform"
        >
          スキップして書く
        </button>
      </div>
    </div>
  )
}
