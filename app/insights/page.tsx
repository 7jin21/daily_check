'use client'

import { useState, useEffect } from 'react'
import { getSupabaseClient } from '@/lib/supabase'
import { apiPost } from '@/lib/api-client'
import { STORAGE_KEYS } from '@/lib/constants'
import PersonalityCard from '@/components/insights/PersonalityCard'

interface EmotionTrigger {
  trigger: string
  effect: 'positive' | 'negative'
  description: string
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

interface WeeklyReport {
  narrative: string
  highlight: string
  challenge: string
  nextFocus: string
  weekMood: string
  focusReview?: string
  entryCount: number
  avgMood: number
  isFallback?: boolean
}

interface CachedAnalysis {
  result: AnalysisResult
  timestamp: number
}

interface CachedWeeklyReport {
  result: WeeklyReport
  timestamp: number
}

interface LocalStats {
  recorded: number
  totalDays: number
  moodDist: Record<number, number>
  topEmotions: { emotion: string; count: number }[]
  recentMoods: { date: string; mood: number }[]
  weekdayMoods: { label: string; avg: number; count: number }[]
  tagMoods: { tag: string; avg: number; diff: number; count: number }[]
  avgMood: number
}

const CACHE_KEY = STORAGE_KEYS.INSIGHTS_CACHE
const WEEKLY_CACHE_KEY = STORAGE_KEYS.WEEKLY_REPORT_CACHE
const CACHE_TTL = 24 * 60 * 60 * 1000
const WEEKLY_CACHE_TTL = 6 * 60 * 60 * 1000

const MOOD_EMOJI: Record<number, string> = { 1: '😞', 2: '😕', 3: '😐', 4: '🙂', 5: '😄' }
const MOOD_COLOR = ['', '#b5654a', '#c5895f', '#cdbf9a', '#9caa7e', '#6f8a5f']

const TREND_ICON = { improving: '📈', stable: '➡️', declining: '📉' }
const TREND_LABEL = { improving: '改善傾向', stable: '安定', declining: '要注意' }

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

function formatAge(ts: number) {
  const m = Math.floor((Date.now() - ts) / 60000)
  if (m < 1) return 'たった今'
  if (m < 60) return `${m}分前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}時間前`
  return `${Math.floor(h / 24)}日前`
}

function moodColorFor(avg: number): string {
  const idx = Math.min(5, Math.max(1, Math.round(avg)))
  return MOOD_COLOR[idx]
}

export default function InsightsPage() {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasEnoughData, setHasEnoughData] = useState(true)
  const [cachedAt, setCachedAt] = useState<number | null>(null)
  const [localStats, setLocalStats] = useState<LocalStats | null>(null)
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReport | null>(null)
  const [isWeeklyLoading, setIsWeeklyLoading] = useState(false)
  const [weeklyError, setWeeklyError] = useState<string | null>(null)
  const [weeklyCachedAt, setWeeklyCachedAt] = useState<number | null>(null)

  // 「AIに聞いてみる」
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [askedQuestion, setAskedQuestion] = useState<string | null>(null)
  const [isAsking, setIsAsking] = useState(false)
  const [askError, setAskError] = useState<string | null>(null)

  useEffect(() => {
    loadLocalStats()
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      if (raw) {
        const cached: CachedAnalysis = JSON.parse(raw)
        if (Date.now() - cached.timestamp < CACHE_TTL) {
          setAnalysis(cached.result)
          setCachedAt(cached.timestamp)
        }
      }
    } catch { /* ignore */ }
    try {
      const raw = localStorage.getItem(WEEKLY_CACHE_KEY)
      if (raw) {
        const cached: CachedWeeklyReport = JSON.parse(raw)
        if (Date.now() - cached.timestamp < WEEKLY_CACHE_TTL) {
          setWeeklyReport(cached.result)
          setWeeklyCachedAt(cached.timestamp)
        }
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadLocalStats = async () => {
    try {
      const supabase = getSupabaseClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const jstToday = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
      const [y, m, d] = jstToday.split('-').map(Number)
      const from = new Date(y, m - 1, d - 29).toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })

      const { data } = await supabase
        .from('diary_entries')
        .select('entry_date, mood, dominant_emotion, tags')
        .eq('user_id', user.id)
        .gte('entry_date', from)
        .order('entry_date', { ascending: false })
        .limit(30)

      if (!data) return

      const moodDist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      const emotionCounts: Record<string, number> = {}
      const weekdayAgg: Record<number, { sum: number; count: number }> = {}
      const tagAgg: Record<string, { sum: number; count: number }> = {}
      let moodSum = 0
      let moodCount = 0

      for (const e of data) {
        if (e.mood >= 1 && e.mood <= 5) {
          moodDist[e.mood]++
          moodSum += e.mood
          moodCount++
          // 曜日別（JST）
          const dow = new Date(`${e.entry_date}T12:00:00+09:00`).getDay()
          weekdayAgg[dow] = { sum: (weekdayAgg[dow]?.sum ?? 0) + e.mood, count: (weekdayAgg[dow]?.count ?? 0) + 1 }
          // タグ別
          if (Array.isArray(e.tags)) {
            for (const tag of e.tags as string[]) {
              if (typeof tag !== 'string' || !tag.trim()) continue
              tagAgg[tag] = { sum: (tagAgg[tag]?.sum ?? 0) + e.mood, count: (tagAgg[tag]?.count ?? 0) + 1 }
            }
          }
        }
        if (e.dominant_emotion?.trim()) {
          emotionCounts[e.dominant_emotion] = (emotionCounts[e.dominant_emotion] ?? 0) + 1
        }
      }

      const avgMood = moodCount > 0 ? moodSum / moodCount : 0

      // 曜日×気分（記録がある曜日のみ、月曜始まり）
      const weekdayMoods = [1, 2, 3, 4, 5, 6, 0]
        .filter((dow) => weekdayAgg[dow])
        .map((dow) => ({
          label: WEEKDAY_LABELS[dow],
          avg: Math.round((weekdayAgg[dow].sum / weekdayAgg[dow].count) * 10) / 10,
          count: weekdayAgg[dow].count,
        }))

      // タグ×気分（2回以上出たタグのみ、全体平均との差が大きい順）
      const tagMoods = Object.entries(tagAgg)
        .filter(([, v]) => v.count >= 2)
        .map(([tag, v]) => {
          const avg = v.sum / v.count
          return {
            tag,
            avg: Math.round(avg * 10) / 10,
            diff: Math.round((avg - avgMood) * 10) / 10,
            count: v.count,
          }
        })
        .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
        .slice(0, 6)

      setLocalStats({
        recorded: data.length,
        totalDays: 30,
        moodDist,
        topEmotions: Object.entries(emotionCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([emotion, count]) => ({ emotion, count })),
        recentMoods: data.slice(0, 7).map((e) => ({ date: e.entry_date, mood: e.mood })).reverse(),
        weekdayMoods,
        tagMoods,
        avgMood: Math.round(avgMood * 10) / 10,
      })
    } catch { /* ignore */ }
  }

  const loadWeeklyReport = async () => {
    setIsWeeklyLoading(true)
    setWeeklyError(null)
    try {
      // 前回レポートの「来週のフォーカス」を渡すと、AI がそのふり返りも書いてくれる
      const result = await apiPost<WeeklyReport | { status: string }>(
        '/api/weekly-report',
        { previousFocus: weeklyReport?.nextFocus ?? undefined },
        { retry: false }
      )
      if ('status' in result) {
        setWeeklyError(result.status === 'no_data' ? '今週の記録がありません' : '取得に失敗しました')
      } else {
        const now = Date.now()
        // フォールバック（AI不通時の簡易版）はキャッシュしない — 次回は本物を試す
        if (!result.isFallback) {
          try { localStorage.setItem(WEEKLY_CACHE_KEY, JSON.stringify({ result, timestamp: now })) } catch { /* ignore */ }
        }
        setWeeklyReport(result)
        setWeeklyCachedAt(now)
      }
    } catch (err) {
      setWeeklyError(err instanceof Error ? err.message : '取得に失敗しました')
    } finally {
      setIsWeeklyLoading(false)
    }
  }

  const loadAnalysis = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await apiPost<AnalysisResult | { status: string }>('/api/analyze', {}, { retry: false })
      if ('status' in result) {
        if (result.status === 'insufficient_data') setHasEnoughData(false)
        else setError('データの取得に失敗しました')
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

  const maxMoodCount = localStats ? Math.max(...Object.values(localStats.moodDist), 1) : 1
  const recordRate = localStats ? Math.round((localStats.recorded / localStats.totalDays) * 100) : 0

  return (
    <div className="px-5 pt-8 pb-8 space-y-6">
      <div className="section-head" style={{ borderBottomColor: 'var(--divider-strong)' }}>
        <div className="eyebrow">Insights</div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">インサイト</h1>
      </div>

      {/* ─── ローカル統計（即時表示） ─── */}
      {localStats && (
        <>
          {/* 記録ペース */}
          <div className="card">
            <h2 className="font-bold text-[var(--foreground)] mb-3">過去30日の記録ペース</h2>
            <div className="flex items-end justify-between mb-2">
              <span className="text-3xl font-bold text-[var(--foreground)]">
                {localStats.recorded}
                <span className="text-base text-[var(--muted-2)] font-normal"> / 30日</span>
              </span>
              <span className="text-lg font-semibold text-[var(--primary)]">{recordRate}%</span>
            </div>
            <div className="h-2.5 bg-[var(--surface-secondary)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
                style={{ width: `${recordRate}%` }}
              />
            </div>
          </div>

          {/* 気分の分布 */}
          <div className="card">
            <h2 className="font-bold text-[var(--foreground)] mb-4">気分の分布</h2>
            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map((level) => {
                const count = localStats.moodDist[level] ?? 0
                const pct = (count / maxMoodCount) * 100
                return (
                  <div key={level} className="flex items-center gap-3">
                    <span className="text-xl w-8 flex-shrink-0 text-center">{MOOD_EMOJI[level]}</span>
                    <div className="flex-1 h-5 bg-[var(--surface-secondary)] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: MOOD_COLOR[level] }}
                      />
                    </div>
                    <span className="text-sm text-[var(--muted)] w-6 text-right flex-shrink-0">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 曜日×気分 */}
          {localStats.weekdayMoods.length >= 3 && (
            <div className="card">
              <h2 className="font-bold text-[var(--foreground)] mb-1">曜日と気分</h2>
              <p className="text-xs text-[var(--muted-2)] mb-4">過去30日の曜日別平均</p>
              <div className="flex items-end justify-between gap-1.5" style={{ height: 88 }}>
                {localStats.weekdayMoods.map((w) => (
                  <div key={w.label} className="flex-1 flex flex-col items-center justify-end gap-1">
                    <span className="text-[10px] text-[var(--muted)] tabular-nums">{w.avg}</span>
                    <div
                      className="w-full rounded-t-sm transition-all"
                      style={{
                        height: `${(w.avg / 5) * 56}px`,
                        backgroundColor: moodColorFor(w.avg),
                        borderRadius: 4,
                      }}
                    />
                    <span className="text-[10px] text-[var(--muted-2)]">{w.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* タグ×気分 */}
          {localStats.tagMoods.length > 0 && (
            <div className="card">
              <h2 className="font-bold text-[var(--foreground)] mb-1">タグと気分の関係</h2>
              <p className="text-xs text-[var(--muted-2)] mb-3">
                そのタグが付いた日の平均気分（全体平均 {localStats.avgMood} との差）
              </p>
              <ul className="space-y-2">
                {localStats.tagMoods.map((t) => (
                  <li key={t.tag} className="flex items-center gap-3">
                    <span className="text-sm text-[var(--primary)] flex-1 min-w-0 truncate">#{t.tag}</span>
                    <span className="text-sm font-semibold text-[var(--foreground)] tabular-nums">{t.avg}</span>
                    <span
                      className="text-xs font-medium tabular-nums w-12 text-right"
                      style={{ color: t.diff >= 0 ? '#5a7350' : '#9c4a2f' }}
                    >
                      {t.diff >= 0 ? `+${t.diff}` : t.diff}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 直近7日の気分 */}
          {localStats.recentMoods.length > 0 && (
            <div className="card">
              <h2 className="font-bold text-[var(--foreground)] mb-4">直近の気分推移</h2>
              <div className="flex items-end justify-between gap-1" style={{ height: 72 }}>
                {localStats.recentMoods.map((e) => (
                  <div key={e.date} className="flex-1 flex flex-col items-center justify-end gap-1">
                    <div
                      className="w-full rounded-t-sm transition-all"
                      style={{
                        height: `${(e.mood / 5) * 56}px`,
                        backgroundColor: MOOD_COLOR[e.mood],
                        borderRadius: 4,
                      }}
                    />
                    <span className="text-[9px] text-[var(--muted-2)]">
                      {new Date(e.date + 'T12:00:00+09:00').toLocaleDateString('ja-JP', {
                        timeZone: 'Asia/Tokyo',
                        month: 'numeric',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* よく感じた感情 */}
          {localStats.topEmotions.length > 0 && (
            <div className="card">
              <h2 className="font-bold text-[var(--foreground)] mb-3">よく感じた感情</h2>
              <div className="flex flex-wrap gap-2">
                {localStats.topEmotions.map(({ emotion, count }) => (
                  <span
                    key={emotion}
                    className="px-3 py-1.5 rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--foreground)] text-sm font-medium"
                  >
                    {emotion}
                    <span className="ml-1.5 text-[var(--primary)] text-xs">{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── AIに聞いてみる ─── */}
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
              className="flex-1 px-4 py-3 rounded-[3px] border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
            <button
              onClick={handleAsk}
              disabled={isAsking || !question.trim()}
              className="px-4 py-3 rounded-[3px] bg-[var(--accent)] text-[#2a2622] text-sm font-bold disabled:opacity-40 active:scale-95 transition-transform flex-shrink-0"
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
            <div className="mt-4 p-4 rounded-[3px] bg-[var(--surface-secondary)] animate-fade-in">
              {askedQuestion && (
                <p className="text-xs text-[var(--muted-2)] mb-2">Q. {askedQuestion}</p>
              )}
              <p className="text-sm text-[var(--foreground)] leading-relaxed whitespace-pre-wrap">{answer}</p>
            </div>
          )}
        </div>
      </div>

      {/* ─── 週次レポートセクション ─── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[var(--foreground)]">今週の振り返り</h2>
          <div className="flex flex-col items-end gap-0.5">
            <button
              onClick={loadWeeklyReport}
              disabled={isWeeklyLoading}
              className="text-[var(--primary)] text-sm font-medium disabled:opacity-50"
            >
              {isWeeklyLoading ? '生成中...' : weeklyReport ? '更新' : 'レポートを作成'}
            </button>
            {weeklyCachedAt && !isWeeklyLoading && (
              <span className="text-xs text-[var(--muted-2)]">{formatAge(weeklyCachedAt)}</span>
            )}
          </div>
        </div>

        {isWeeklyLoading && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
            <p className="text-[var(--muted)] text-sm">今週の日記を振り返っています...</p>
          </div>
        )}

        {!isWeeklyLoading && weeklyError && (
          <div className="card text-center py-6">
            <p className="text-[var(--muted)] text-sm">{weeklyError}</p>
          </div>
        )}

        {!isWeeklyLoading && !weeklyReport && !weeklyError && (
          <div className="card text-center py-8">
            <p className="text-3xl mb-3">📅</p>
            <p className="font-bold text-[var(--foreground)]">今週を振り返る</p>
            <p className="text-sm text-[var(--muted)] mt-1 mb-4">直近7日間の日記からナラティブレポートを生成</p>
            <button
              onClick={loadWeeklyReport}
              className="px-6 py-2.5 rounded-[2px] bg-[var(--accent)] text-[#2a2622] font-bold text-sm"
            >
              レポートを作成
            </button>
          </div>
        )}

        {!isWeeklyLoading && weeklyReport && (
          <div className="space-y-3">
            {weeklyReport.isFallback && (
              <p className="p-3 rounded-[3px] text-xs" style={{ background: 'rgba(197,137,95,0.12)', border: '1px solid rgba(197,137,95,0.35)', color: '#a4683f' }}>
                ⚠️ AIレポートを生成できなかったため、記録データからの簡易版を表示しています。「更新」で再試行できます。
              </p>
            )}
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">🗓</span>
                <span className="font-bold text-[var(--foreground)]">
                  今週のキーワード：
                  <span className="ml-1 text-[var(--primary)]">{weeklyReport.weekMood}</span>
                </span>
                <span className="ml-auto text-xs text-[var(--muted-2)]">
                  {weeklyReport.entryCount}件 / 平均気分 {weeklyReport.avgMood}
                </span>
              </div>
              <p className="text-sm text-[var(--foreground)] leading-relaxed">
                {weeklyReport.narrative}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {weeklyReport.focusReview && (
                <div className="card" style={{ background: 'rgba(205,191,154,0.14)', borderColor: 'rgba(205,191,154,0.4)' }}>
                  <p className="text-xs font-bold mb-1" style={{ color: '#8a7c4e' }}>🔁 先週のフォーカスは…</p>
                  <p className="text-sm text-[var(--foreground)]">{weeklyReport.focusReview}</p>
                </div>
              )}
              <div className="card" style={{ background: 'rgba(111,138,95,0.10)', borderColor: 'rgba(111,138,95,0.3)' }}>
                <p className="text-xs font-bold mb-1" style={{ color: '#5a7350' }}>✨ 今週のハイライト</p>
                <p className="text-sm text-[var(--foreground)]">{weeklyReport.highlight}</p>
              </div>
              <div className="card" style={{ background: 'rgba(197,137,95,0.10)', borderColor: 'rgba(197,137,95,0.3)' }}>
                <p className="text-xs font-bold mb-1" style={{ color: '#a4683f' }}>💪 乗り越えたこと</p>
                <p className="text-sm text-[var(--foreground)]">{weeklyReport.challenge}</p>
              </div>
              <div className="card" style={{ background: 'rgba(156,107,74,0.10)', borderColor: 'rgba(156,107,74,0.3)' }}>
                <p className="text-xs font-bold mb-1" style={{ color: 'var(--primary)' }}>🎯 来週のフォーカス</p>
                <p className="text-sm text-[var(--foreground)]">{weeklyReport.nextFocus}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── AI分析セクション ─── */}
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
              className="px-6 py-2.5 rounded-[2px] bg-[var(--accent)] text-[#2a2622] font-bold text-sm"
            >
              分析を開始
            </button>
          </div>
        )}

        {!isLoading && analysis && (
          <>
            {analysis.isFallback && (
              <p className="mb-4 p-3 rounded-[3px] text-xs" style={{ background: 'rgba(197,137,95,0.12)', border: '1px solid rgba(197,137,95,0.35)', color: '#a4683f' }}>
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
                <p className="text-xs text-[var(--muted-2)] mb-3">気分に影響しやすいパターン</p>
                <ul className="space-y-3">
                  {analysis.emotionTriggers.map((t, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="text-lg flex-shrink-0">
                        {t.effect === 'positive' ? '🔆' : '🔻'}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-[var(--foreground)]">{t.trigger}</p>
                        <p className="text-xs text-[var(--muted-2)] mt-0.5">{t.description}</p>
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
    </div>
  )
}
