'use client'

import { useState } from 'react'
import { apiPost } from '@/lib/api-client'

// 「AIに聞いてみる」: 直近の日記をもとに、本人の質問に答える
export default function AskSection() {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [askedQuestion, setAskedQuestion] = useState<string | null>(null)
  const [isAsking, setIsAsking] = useState(false)
  const [askError, setAskError] = useState<string | null>(null)

  const handleAsk = async () => {
    const q = question.trim()
    if (!q || isAsking) return
    setIsAsking(true)
    setAskError(null)
    setAnswer(null)
    try {
      const result = await apiPost<{ answer: string }>('/api/ask', { question: q }, { retry: false })
      setAnswer(result.answer)
      setAskedQuestion(q)
      setQuestion('')
    } catch (err) {
      setAskError(err instanceof Error ? err.message : '回答の生成に失敗しました')
    } finally {
      setIsAsking(false)
    }
  }

  return (
    <div>
      <h2 className="text-lg font-bold text-[var(--foreground)] mb-4">AIに聞いてみる</h2>
      <div className="card">
        <p className="text-xs text-[var(--muted-2)] mb-3">
          直近の日記をもとに答えます。例:「最近気分がいい日の共通点は？」「今週なんで疲れてたんだろう」
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value.slice(0, 200))}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAsk() }}
            placeholder="日記について質問..."
            className="flex-1 px-4 py-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
          <button
            onClick={handleAsk}
            disabled={isAsking || !question.trim()}
            className="px-4 py-3 rounded-2xl bg-[var(--accent)] text-[#f7f4ea] text-sm font-bold disabled:opacity-40 active:scale-95 transition-transform flex-shrink-0"
          >
            {isAsking ? '...' : '質問'}
          </button>
        </div>

        {isAsking && (
          <div className="flex items-center gap-3 mt-4">
            <div className="spinner" style={{ width: 18, height: 18 }} />
            <p className="text-sm text-[var(--muted)]">日記を読み返しています...</p>
          </div>
        )}

        {askError && <p className="mt-3 text-xs" style={{ color: '#9c4a2f' }}>{askError}</p>}

        {answer && !isAsking && (
          <div className="mt-4 p-4 rounded-2xl bg-[var(--surface-secondary)] animate-fade-in">
            {askedQuestion && (
              <p className="text-xs text-[var(--muted-2)] mb-2">Q. {askedQuestion}</p>
            )}
            <p className="text-sm text-[var(--foreground)] leading-relaxed whitespace-pre-wrap">{answer}</p>
          </div>
        )}
      </div>
    </div>
  )
}
