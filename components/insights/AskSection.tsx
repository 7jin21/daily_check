'use client'

import { useState, useEffect } from 'react'
import { apiPost } from '@/lib/api-client'
import InkRings from '@/components/ui/InkRings'
import { useInsightsSession } from './InsightsSessionBoundary'
import { requestError } from './shared'

// 「AIに聞いてみる」: 直近の日記をもとに、本人の質問に答える
export default function AskSection() {
  const { userId, session } = useInsightsSession()
  const [question, setQuestion] = useState('')
  // 聞いたことと、その答え（いつも一緒に出す）
  const [qa, setQa] = useState<{ q: string; answer: string } | null>(null)
  const [isAsking, setIsAsking] = useState(false)
  const [askError, setAskError] = useState<string | null>(null)

  useEffect(() => () => session.cancel('ask'), [session])

  const handleAsk = async () => {
    const q = question.trim()
    if (!q || isAsking) return
    const request = session.begin('ask', userId)
    if (!request) return
    setIsAsking(true)
    setAskError(null)
    setQa(null)
    try {
      const result = await apiPost<{ answer: string }>('/api/ask', { question: q }, { signal: request.signal })
      if (!request.isCurrent()) return
      setQa({ q, answer: result.answer })
      setQuestion('')
    } catch (err) {
      if (request.isActive()) setAskError(requestError(request, err, '回答の生成に失敗しました'))
    } finally {
      if (request.isActive()) setIsAsking(false)
      request.finish()
    }
  }

  return (
    <div>
      <h2 className="font-mincho text-lg font-semibold tracking-wide text-[var(--foreground)] mb-4">AI に聞いてみる</h2>
      <div className="card">
        <p className="text-xs text-[var(--muted-2)] mb-3">
          直近の日記をもとに答えます。例:「最近気分がいい日の共通点は？」「今週なんで疲れてたんだろう」
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value.slice(0, 200))}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return
              if (e.key === 'Enter') handleAsk()
            }}
            placeholder="日記について聞く…"
            aria-label="日記について聞きたいこと"
            className="flex-1 min-w-0 px-4 py-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] placeholder:text-[var(--muted-2)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
          <button type="button" onClick={handleAsk} disabled={isAsking || !question.trim()} className="btn btn-primary btn-sm flex-shrink-0" style={{ minHeight: 48 }}>
            聞く
          </button>
        </div>

        {isAsking && (
          <div className="flex items-center gap-3 mt-4" role="status">
            <InkRings size="sm" />
            <p className="font-mincho text-sm text-[var(--muted)]">日記を、読み返しています</p>
          </div>
        )}

        {askError && (
          <p className="mt-3 text-xs text-[var(--danger)]" role="alert">
            {askError}
          </p>
        )}

        {qa?.answer && !isAsking && (
          <div className="mt-4 p-4 rounded-2xl bg-[var(--surface-secondary)] animate-fade-in">
            <p className="text-xs text-[var(--muted-2)] mb-2">Q. {qa.q}</p>
            <p className="font-mincho text-[0.9375rem] text-[var(--foreground)] leading-loose whitespace-pre-wrap prose-ja">{qa.answer}</p>
          </div>
        )}
      </div>
    </div>
  )
}
