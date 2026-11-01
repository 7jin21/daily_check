'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { apiPost } from '@/lib/api-client'
import { STORAGE_KEYS } from '@/lib/constants'
import PersonalityCard from './PersonalityCard'
import { formatAge, MOOD_COLOR } from './shared'
import InkRings from '@/components/ui/InkRings'
import { AlertIcon, ChevronRightIcon, MirrorMark, TrendDownIcon, TrendFlatIcon, TrendUpIcon } from '@/components/ui/icons'

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

const TREND_ICON = { improving: TrendUpIcon, stable: TrendFlatIcon, declining: TrendDownIcon }
const TREND_LABEL = { improving: '改善傾向', stable: '安定', declining: '要注意' }
const TREND_COLOR = { improving: 'var(--positive)', stable: 'var(--muted)', declining: 'var(--notice)' }

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
        <h2 className="font-mincho text-lg font-semibold tracking-wide text-[var(--foreground)]">AI パーソナル分析</h2>
        <div className="flex flex-col items-end gap-0.5">
          <button
            type="button"
            onClick={loadAnalysis}
            disabled={isLoading}
            className="btn-quiet"
            style={{ minHeight: 32, color: 'var(--primary)', fontWeight: 700 }}
          >
            {isLoading ? '分析しています…' : analysis ? '更新する' : '分析する'}
          </button>
          {cachedAt && !isLoading && (
            <span className="text-xs text-[var(--muted-2)]">{formatAge(cachedAt)}</span>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-14 gap-5" role="status">
          <InkRings size="md" />
          <p className="font-mincho text-[var(--muted)] text-sm tracking-wide">過去の日記を、読み返しています</p>
        </div>
      )}

      {!isLoading && !hasEnoughData && (
        <div className="card text-center py-10">
          <MirrorMark size={40} className="empty-mark" />
          <p className="font-mincho font-semibold text-[var(--foreground)]">もう少し、記録がたまってから</p>
          <p className="text-sm text-[var(--muted)] mt-1">分析には 5 日分以上の日記が必要です</p>
        </div>
      )}

      {!isLoading && error && (
        <div className="card text-center py-8">
          <p className="text-[var(--danger)] text-sm" role="alert">
            {error}
          </p>
          <button type="button" onClick={loadAnalysis} className="btn btn-secondary btn-sm mt-3">
            もう一度試す
          </button>
        </div>
      )}

      {!analysis && !isLoading && hasEnoughData && !error && (
        <div className="card text-center py-10">
          <MirrorMark size={40} className="empty-mark" />
          <p className="font-mincho font-semibold text-[var(--foreground)]">日記から、自分の傾向を読み取ります</p>
          <p className="text-sm text-[var(--muted)] mt-1 mb-5">強み・大切にしているもの・気分が動くきっかけ</p>
          <button type="button" onClick={loadAnalysis} className="btn btn-primary btn-sm">
            分析する
          </button>
        </div>
      )}

      {!isLoading && analysis && (
        <>
          {analysis.isFallback && (
            <div className="notice mb-4" data-tone="warn" role="status">
              <AlertIcon size={18} />
              <p>AI 分析を実行できなかったため、簡易分析を表示しています。「更新する」で再試行できます。</p>
            </div>
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
            <div className="card flex flex-col items-center justify-center text-center">
              {(() => {
                const Trend = TREND_ICON[analysis.moodTrend] ?? TrendFlatIcon
                return <Trend size={28} style={{ color: TREND_COLOR[analysis.moodTrend] ?? 'var(--muted)' }} />
              })()}
              <p className="text-xs text-[var(--muted)] mt-1">{TREND_LABEL[analysis.moodTrend]}</p>
            </div>
          </div>

          <PersonalityCard analysis={analysis} />

          {/* 価値観（内省ガイドの回答から抽出） */}
          {analysis.coreValues && analysis.coreValues.length > 0 && (
            <div className="card mt-4">
              <h3 className="font-mincho font-semibold text-[var(--foreground)] mb-1">あなたが大切にしているもの</h3>
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
              <h3 className="font-mincho font-semibold text-[var(--foreground)] mb-1">気分が動くきっかけ</h3>
              <p className="text-xs text-[var(--muted-2)] mb-3">気分に影響しやすいパターン（根拠になった日記つき）</p>
              <ul className="space-y-3">
                {analysis.emotionTriggers.map((t, i) => (
                  <li key={i} className="flex items-start gap-3">
                    {/* 上向き＝気分が晴れるきっかけ／下向き＝沈むきっかけ */}
                    <span
                      className="flex-shrink-0 mt-0.5 w-7 h-7 rounded-full inline-flex items-center justify-center"
                      style={{
                        color: t.effect === 'positive' ? 'var(--positive)' : 'var(--notice)',
                        background: `color-mix(in srgb, ${t.effect === 'positive' ? 'var(--mood-5)' : 'var(--mood-1)'} 14%, transparent)`,
                      }}
                    >
                      {t.effect === 'positive' ? <TrendUpIcon size={16} /> : <TrendDownIcon size={16} />}
                      <span className="sr-only">{t.effect === 'positive' ? '気分が晴れるきっかけ' : '気分が沈むきっかけ'}</span>
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
                              <ChevronRightIcon size={14} className="flex-none text-[var(--faint)]" />
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
              <h3 className="font-mincho font-semibold text-[var(--foreground)] mb-3">次にできること</h3>
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
