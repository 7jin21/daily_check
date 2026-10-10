'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { apiPost } from '@/lib/api-client'
import { STORAGE_KEYS } from '@/lib/constants'
import PersonalityCard from './PersonalityCard'
import { formatAge, MOOD_COLOR } from './shared'

interface EmotionTrigger {
  trigger: string
  effect: 'positive' | 'negative'
  description: string
  // 根拠になった日と、その日の本人の言葉（古いキャッシュには無い）
  evidence?: { date: string; mood: number | null; quote: string }[]
}

interface AnalysisResult {
  personalityType: string
  description: string
  strengths: string[]
  growthAreas: string[]
  emotionalPatterns: string[]
  coreValues?: string[]
  recommendations: string[]
  emotionTriggers: EmotionTrigger[]
  moodTrend: 'improving' | 'stable' | 'declining'
  averageMood: number
  totalEntries: number
  isFallback?: boolean
}

interface CachedAnalysis {
  result: AnalysisResult
  timestamp: number
}

const CACHE_KEY = STORAGE_KEYS.INSIGHTS_CACHE
const CACHE_TTL = 24 * 60 * 60 * 1000

const TREND_ICON = { improving: '📈', stable: '➡️', declining: '📉' }
const TREND_LABEL = { improving: '改善傾向', stable: '安定', declining: '要注意' }

/** キャッシュや API の分析結果が、画面で使う形をしているか（欠けていると表示が落ちる） */
function isValidAnalysis(r: unknown): r is AnalysisResult {
  const a = r as Partial<AnalysisResult> | null
  return (
    !!a &&
    typeof a.personalityType === 'string' &&
    Array.isArray(a.strengths) &&
    Array.isArray(a.growthAreas) &&
    Array.isArray(a.emotionalPatterns) &&
    Array.isArray(a.recommendations) &&
    Array.isArray(a.emotionTriggers) &&
    typeof a.averageMood === 'number'
  )
}

// 「AI パーソナル分析」: 過去の日記から傾向・強み・価値観・感情トリガーを読み取る
export default function AnalysisSection() {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasEnoughData, setHasEnoughData] = useState(true)
  const [cachedAt, setCachedAt] = useState<number | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      if (raw) {
        const cached: CachedAnalysis = JSON.parse(raw)
        if (Date.now() - cached.timestamp < CACHE_TTL && isValidAnalysis(cached.result)) {
          setAnalysis(cached.result)
          setCachedAt(cached.timestamp)
        }
      }
    } catch { /* ignore */ }
  }, [])

  const loadAnalysis = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await apiPost<AnalysisResult | { status: string }>('/api/analyze', {}, { retry: false })
      if ('status' in result) {
        if (result.status === 'insufficient_data') setHasEnoughData(false)
        else setError('データの取得に失敗しました')
      } else if (!isValidAnalysis(result)) {
        setError('分析結果を読み取れませんでした。もう一度お試しください')
      } else {
        const now = Date.now()
        // フォールバック（AI不通時の簡易版）はキャッシュしない
        if (!result.isFallback) {
          try { localStorage.setItem(CACHE_KEY, JSON.stringify({ result, timestamp: now })) } catch { /* ignore */ }
        }
        setAnalysis(result)
        setCachedAt(now)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'データの取得に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-[var(--foreground)]">AI パーソナル分析</h2>
        <div className="flex flex-col items-end gap-0.5">
          <button
            onClick={loadAnalysis}
            disabled={isLoading}
            className="text-[var(--primary)] text-sm font-medium disabled:opacity-50"
          >
            {isLoading ? '分析中...' : analysis ? '更新' : '分析する'}
          </button>
          {cachedAt && !isLoading && (
            <span className="text-xs text-[var(--muted-2)]">{formatAge(cachedAt)}</span>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
          <p className="text-[var(--muted)] text-sm">過去の日記を分析しています...</p>
        </div>
      )}

      {!isLoading && !hasEnoughData && (
        <div className="card text-center py-10">
          <p className="text-4xl mb-3">📊</p>
          <p className="font-bold text-[var(--foreground)]">データが足りません</p>
          <p className="text-sm text-[var(--muted)] mt-1">最低5件の日記が必要です</p>
        </div>
      )}

      {!isLoading && error && (
        <div className="card text-center py-8">
          <p className="text-red-500 text-sm">{error}</p>
          <button onClick={loadAnalysis} className="mt-3 text-[var(--primary)] text-sm font-medium">
            再試行
          </button>
        </div>
      )}

      {!analysis && !isLoading && hasEnoughData && !error && (
        <div className="card text-center py-10">
          <p className="text-4xl mb-3">🤖</p>
          <p className="font-bold text-[var(--foreground)]">AIが日記を分析します</p>
          <p className="text-sm text-[var(--muted)] mt-1 mb-4">あなたの傾向・強み・価値観を発見</p>
          <button
            onClick={loadAnalysis}
            className="px-6 py-2.5 rounded-full bg-[var(--accent)] text-[#f7f4ea] font-bold text-sm"
          >
            分析を開始
          </button>
        </div>
      )}

      {!isLoading && analysis && (
        <>
          {analysis.isFallback && (
            <p className="mb-4 p-3 rounded-2xl text-xs" style={{ background: 'rgba(197,137,95,0.12)', border: '1px solid rgba(197,137,95,0.35)', color: '#a4683f' }}>
              ⚠️ AI分析を実行できなかったため、簡易分析を表示しています。「更新」で再試行できます。
            </p>
          )}

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="card text-center">
              <p className="text-2xl font-bold text-[var(--primary)]">{analysis.totalEntries}</p>
              <p className="text-xs text-[var(--muted)] mt-1">総記録数</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-bold text-[var(--accent)]">{analysis.averageMood.toFixed(1)}</p>
              <p className="text-xs text-[var(--muted)] mt-1">平均気分</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl">{TREND_ICON[analysis.moodTrend]}</p>
              <p className="text-xs text-[var(--muted)] mt-1">{TREND_LABEL[analysis.moodTrend]}</p>
            </div>
          </div>

          <PersonalityCard analysis={analysis} />

          {/* 価値観（内省ガイドの回答から抽出） */}
          {analysis.coreValues && analysis.coreValues.length > 0 && (
            <div className="card mt-4">
              <h3 className="font-bold text-[var(--foreground)] mb-1">🧭 あなたが大切にしているもの</h3>
              <p className="text-xs text-[var(--muted-2)] mb-3">日記とふりかえりの回答から AI が読み取った価値観</p>
              <div className="flex flex-wrap gap-2">
                {analysis.coreValues.map((v) => (
                  <span
                    key={v}
                    className="px-3 py-1.5 rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--foreground)] text-sm font-medium"
                  >
                    {v}
                  </span>
                ))}
              </div>
            </div>
          )}

          {analysis.emotionTriggers && analysis.emotionTriggers.length > 0 && (
            <div className="card mt-4">
              <h3 className="font-bold text-[var(--foreground)] mb-3">
                🔍 感情トリガー分析
              </h3>
              <p className="text-xs text-[var(--muted-2)] mb-3">気分に影響しやすいパターン（根拠になった日記つき）</p>
              <ul className="space-y-3">
                {analysis.emotionTriggers.map((t, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="text-lg flex-shrink-0">
                      {t.effect === 'positive' ? '🔆' : '🔻'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[var(--foreground)]">{t.trigger}</p>
                      <p className="text-xs text-[var(--muted-2)] mt-0.5">{t.description}</p>
                      {/* 根拠: その日の本人の言葉と、日記へのリンク */}
                      {t.evidence && t.evidence.length > 0 && (
                        <div className="mt-2 flex flex-col gap-1.5">
                          {t.evidence.map((ev) => (
                            <Link
                              key={ev.date}
                              href={`/entries/${ev.date}`}
                              className="evidence-chip"
                              style={{ borderLeftColor: ev.mood ? MOOD_COLOR[ev.mood] : 'var(--border)' }}
                            >
                              <span className="evidence-date">
                                {Number(ev.date.slice(5, 7))}/{Number(ev.date.slice(8, 10))}
                              </span>
                              <span className="evidence-quote">{ev.quote ? `「${ev.quote}」` : 'この日の日記'}</span>
                              <span className="text-[var(--muted-2)]">›</span>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {analysis.recommendations.length > 0 && (
            <div className="card mt-4">
              <h3 className="font-bold text-[var(--foreground)] mb-3">
                💡 おすすめアクション
              </h3>
              <ul className="space-y-2">
                {analysis.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[var(--muted)]">
                    <span className="text-[var(--primary)] mt-0.5">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
