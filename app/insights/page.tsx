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
  recommendations: string[]
  emotionTriggers: EmotionTrigger[]
  moodTrend: 'improving' | 'stable' | 'declining'
  averageMood: number
  totalEntries: number
}

interface WeeklyReport {
  narrative: string
  highlight: string
  challenge: string
  nextFocus: string
  weekMood: string
  entryCount: number
  avgMood: number
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
}

const CACHE_KEY = STORAGE_KEYS.INSIGHTS_CACHE
const WEEKLY_CACHE_KEY = STORAGE_KEYS.WEEKLY_REPORT_CACHE
const CACHE_TTL = 24 * 60 * 60 * 1000
const WEEKLY_CACHE_TTL = 6 * 60 * 60 * 1000

const MOOD_EMOJI: Record<number, string> = { 1: '😞', 2: '😕', 3: '😐', 4: '🙂', 5: '😄' }
const MOOD_COLOR = ['', '#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e']

const TREND_ICON = { improving: '📈', stable: '➡️', declining: '📉' }
const TREND_LABEL = { improving: '改善傾向', stable: '安定', declining: '要注意' }

function formatAge(ts: number) {
  const m = Math.floor((Date.now() - ts) / 60000)
  if (m < 1) return 'たった今'
  if (m < 60) return `${m}分前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}時間前`
  return `${Math.floor(h / 24)}日前`
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
        .select('entry_date, mood, dominant_emotion')
        .eq('user_id', user.id)
        .gte('entry_date', from)
        .order('entry_date', { ascending: false })
        .limit(30)

      if (!data) return

      const moodDist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      const emotionCounts: Record<string, number> = {}
      for (const e of data) {
        if (e.mood >= 1 && e.mood <= 5) moodDist[e.mood]++
        if (e.dominant_emotion?.trim()) {
          emotionCounts[e.dominant_emotion] = (emotionCounts[e.dominant_emotion] ?? 0) + 1
        }
      }

      setLocalStats({
        recorded: data.length,
        totalDays: 30,
        moodDist,
        topEmotions: Object.entries(emotionCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([emotion, count]) => ({ emotion, count })),
        recentMoods: data.slice(0, 7).map((e) => ({ date: e.entry_date, mood: e.mood })).reverse(),
      })
    } catch { /* ignore */ }
  }

  const loadWeeklyReport = async () => {
    setIsWeeklyLoading(true)
    setWeeklyError(null)
    try {
      const result = await apiPost<WeeklyReport | { status: string }>('/api/weekly-report', {})
      if ('status' in result) {
        setWeeklyError(result.status === 'no_data' ? '今週の記録がありません' : '取得に失敗しました')
      } else {
        const now = Date.now()
        try { localStorage.setItem(WEEKLY_CACHE_KEY, JSON.stringify({ result, timestamp: now })) } catch { /* ignore */ }
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
      const result = await apiPost<AnalysisResult | { status: string }>('/api/analyze', {})
      if ('status' in result) {
        if (result.status === 'insufficient_data') setHasEnoughData(false)
        else setError('データの取得に失敗しました')
      } else {
        const now = Date.now()
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ result, timestamp: now })) } catch { /* ignore */ }
        setAnalysis(result)
        setCachedAt(now)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'データの取得に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  const maxMoodCount = localStats ? Math.max(...Object.values(localStats.moodDist), 1) : 1
  const recordRate = localStats ? Math.round((localStats.recorded / localStats.totalDays) * 100) : 0

  return (
    <div className="px-4 pt-6 pb-6 space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">インサイト</h1>

      {/* ─── ローカル統計（即時表示） ─── */}
      {localStats && (
        <>
          {/* 記録ペース */}
          <div className="card">
            <h2 className="font-semibold text-slate-700 dark:text-slate-300 mb-3">過去30日の記録ペース</h2>
            <div className="flex items-end justify-between mb-2">
              <span className="text-3xl font-bold text-slate-800 dark:text-white">
                {localStats.recorded}
                <span className="text-base text-slate-400 font-normal"> / 30日</span>
              </span>
              <span className="text-lg font-semibold text-sky-500">{recordRate}%</span>
            </div>
            <div className="h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-400 to-violet-500 transition-all duration-500"
                style={{ width: `${recordRate}%` }}
              />
            </div>
          </div>

          {/* 気分の分布 */}
          <div className="card">
            <h2 className="font-semibold text-slate-700 dark:text-slate-300 mb-4">気分の分布</h2>
            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map((level) => {
                const count = localStats.moodDist[level] ?? 0
                const pct = (count / maxMoodCount) * 100
                return (
                  <div key={level} className="flex items-center gap-3">
                    <span className="text-xl w-8 flex-shrink-0 text-center">{MOOD_EMOJI[level]}</span>
                    <div className="flex-1 h-5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: MOOD_COLOR[level] }}
                      />
                    </div>
                    <span className="text-sm text-slate-500 w-6 text-right flex-shrink-0">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 直近7日の気分 */}
          {localStats.recentMoods.length > 0 && (
            <div className="card">
              <h2 className="font-semibold text-slate-700 dark:text-slate-300 mb-4">直近の気分推移</h2>
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
                    <span className="text-[9px] text-slate-400">
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
              <h2 className="font-semibold text-slate-700 dark:text-slate-300 mb-3">よく感じた感情</h2>
              <div className="flex flex-wrap gap-2">
                {localStats.topEmotions.map(({ emotion, count }) => (
                  <span
                    key={emotion}
                    className="px-3 py-1.5 rounded-full bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 text-sm font-medium"
                  >
                    {emotion}
                    <span className="ml-1.5 text-sky-400/70 text-xs">{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── 週次レポートセクション ─── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">今週の振り返り</h2>
          <div className="flex flex-col items-end gap-0.5">
            <button
              onClick={loadWeeklyReport}
              disabled={isWeeklyLoading}
              className="text-sky-500 text-sm font-medium disabled:opacity-50"
            >
              {isWeeklyLoading ? '生成中...' : weeklyReport ? '更新' : 'レポートを作成'}
            </button>
            {weeklyCachedAt && !isWeeklyLoading && (
              <span className="text-xs text-slate-400">{formatAge(weeklyCachedAt)}</span>
            )}
          </div>
        </div>

        {isWeeklyLoading && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
            <p className="text-slate-500 text-sm">今週の日記を振り返っています...</p>
          </div>
        )}

        {!isWeeklyLoading && weeklyError && (
          <div className="card text-center py-6">
            <p className="text-slate-500 text-sm">{weeklyError}</p>
          </div>
        )}

        {!isWeeklyLoading && !weeklyReport && !weeklyError && (
          <div className="card text-center py-8">
            <p className="text-3xl mb-3">📅</p>
            <p className="font-semibold text-slate-700 dark:text-slate-300">今週を振り返る</p>
            <p className="text-sm text-slate-500 mt-1 mb-4">直近7日間の日記からナラティブレポートを生成</p>
            <button
              onClick={loadWeeklyReport}
              className="px-6 py-2.5 rounded-3xl animated-gradient text-white font-semibold text-sm"
            >
              レポートを作成
            </button>
          </div>
        )}

        {!isWeeklyLoading && weeklyReport && (
          <div className="space-y-3">
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">🗓</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  今週のキーワード：
                  <span className="ml-1 text-sky-500">{weeklyReport.weekMood}</span>
                </span>
                <span className="ml-auto text-xs text-slate-400">
                  {weeklyReport.entryCount}件 / 平均気分 {weeklyReport.avgMood}
                </span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {weeklyReport.narrative}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="card bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800">
                <p className="text-xs font-semibold text-green-600 dark:text-green-400 mb-1">✨ 今週のハイライト</p>
                <p className="text-sm text-slate-700 dark:text-slate-300">{weeklyReport.highlight}</p>
              </div>
              <div className="card bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800">
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1">💪 乗り越えたこと</p>
                <p className="text-sm text-slate-700 dark:text-slate-300">{weeklyReport.challenge}</p>
              </div>
              <div className="card bg-sky-50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-800">
                <p className="text-xs font-semibold text-sky-600 dark:text-sky-400 mb-1">🎯 来週のフォーカス</p>
                <p className="text-sm text-slate-700 dark:text-slate-300">{weeklyReport.nextFocus}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── AI分析セクション ─── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">AI パーソナル分析</h2>
          <div className="flex flex-col items-end gap-0.5">
            <button
              onClick={loadAnalysis}
              disabled={isLoading}
              className="text-sky-500 text-sm font-medium disabled:opacity-50"
            >
              {isLoading ? '分析中...' : analysis ? '更新' : '分析する'}
            </button>
            {cachedAt && !isLoading && (
              <span className="text-xs text-slate-400">{formatAge(cachedAt)}</span>
            )}
          </div>
        </div>

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
            <p className="text-slate-500 text-sm">過去の日記を分析しています...</p>
          </div>
        )}

        {!isLoading && !hasEnoughData && (
          <div className="card text-center py-10">
            <p className="text-4xl mb-3">📊</p>
            <p className="font-semibold text-slate-700 dark:text-slate-300">データが足りません</p>
            <p className="text-sm text-slate-500 mt-1">最低5件の日記が必要です</p>
          </div>
        )}

        {!isLoading && error && (
          <div className="card text-center py-8">
            <p className="text-red-500 text-sm">{error}</p>
            <button onClick={loadAnalysis} className="mt-3 text-sky-500 text-sm font-medium">
              再試行
            </button>
          </div>
        )}

        {!analysis && !isLoading && hasEnoughData && !error && (
          <div className="card text-center py-10">
            <p className="text-4xl mb-3">🤖</p>
            <p className="font-semibold text-slate-700 dark:text-slate-300">AIが日記を分析します</p>
            <p className="text-sm text-slate-500 mt-1 mb-4">あなたの傾向・強み・成長ポイントを発見</p>
            <button
              onClick={loadAnalysis}
              className="px-6 py-2.5 rounded-3xl animated-gradient text-white font-semibold text-sm"
            >
              分析を開始
            </button>
          </div>
        )}

        {!isLoading && analysis && (
          <>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="card text-center">
                <p className="text-2xl font-bold text-sky-500">{analysis.totalEntries}</p>
                <p className="text-xs text-slate-500 mt-1">総記録数</p>
              </div>
              <div className="card text-center">
                <p className="text-2xl font-bold text-violet-500">{analysis.averageMood.toFixed(1)}</p>
                <p className="text-xs text-slate-500 mt-1">平均気分</p>
              </div>
              <div className="card text-center">
                <p className="text-2xl">{TREND_ICON[analysis.moodTrend]}</p>
                <p className="text-xs text-slate-500 mt-1">{TREND_LABEL[analysis.moodTrend]}</p>
              </div>
            </div>

            <PersonalityCard analysis={analysis} />

            {analysis.emotionTriggers && analysis.emotionTriggers.length > 0 && (
              <div className="card mt-4">
                <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-3">
                  🔍 感情トリガー分析
                </h3>
                <p className="text-xs text-slate-400 mb-3">気分に影響しやすいパターン</p>
                <ul className="space-y-3">
                  {analysis.emotionTriggers.map((t, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="text-lg flex-shrink-0">
                        {t.effect === 'positive' ? '🔆' : '🔻'}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{t.trigger}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{t.description}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.recommendations.length > 0 && (
              <div className="card mt-4">
                <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-3">
                  💡 おすすめアクション
                </h3>
                <ul className="space-y-2">
                  {analysis.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <span className="text-sky-400 mt-0.5">•</span>
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
