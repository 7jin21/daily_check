'use client'

import { useState, useEffect } from 'react'
import { apiPost } from '@/lib/api-client'
import { STORAGE_KEYS } from '@/lib/constants'
import { todayJST } from '@/lib/jst'
import { doneInLastWeek, FOCUS_MAX_CHARS, isFocusActive, loadFocus, saveFocus, type Focus } from '@/lib/focus'
import { formatAge } from './shared'

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

interface CachedWeeklyReport {
  result: WeeklyReport
  timestamp: number
}

const WEEKLY_CACHE_KEY = STORAGE_KEYS.WEEKLY_REPORT_CACHE
const WEEKLY_CACHE_TTL = 6 * 60 * 60 * 1000

// 「今週の振り返り」: 直近7日の週次レポートと、来週のフォーカスの採用
export default function WeeklyReportSection() {
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReport | null>(null)
  const [isWeeklyLoading, setIsWeeklyLoading] = useState(false)
  const [weeklyError, setWeeklyError] = useState<string | null>(null)
  const [weeklyCachedAt, setWeeklyCachedAt] = useState<number | null>(null)
  // 採用した「今週のフォーカス」（ホームでワンタップ記録できる）
  const [focus, setFocus] = useState<Focus | null>(null)
  const [focusEditing, setFocusEditing] = useState(false)
  const [focusDraft, setFocusDraft] = useState('')

  useEffect(() => {
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
    const f = loadFocus()
    if (isFocusActive(f, todayJST())) setFocus(f)
  }, [])

  const adoptFocus = (text: string) => {
    const t = text.trim().slice(0, FOCUS_MAX_CHARS)
    if (!t) return
    const next: Focus = { text: t, adoptedAt: todayJST(), doneDates: [] }
    saveFocus(next)
    setFocus(next)
    setFocusEditing(false)
  }

  const loadWeeklyReport = async () => {
    setIsWeeklyLoading(true)
    setWeeklyError(null)
    try {
      // 採用したフォーカス（なければ前回レポートの提案）と実施日数を渡すと、AI がそのふり返りも書く
      // （以前は 6 時間で消えるキャッシュから読んでいたため、翌週にはふり返りが働かなかった）
      const adopted = loadFocus()
      const result = await apiPost<WeeklyReport | { status: string }>(
        '/api/weekly-report',
        adopted
          ? { previousFocus: adopted.text, focusDone: doneInLastWeek(adopted, todayJST()) }
          : { previousFocus: weeklyReport?.nextFocus ?? undefined },
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

  return (
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
            className="px-6 py-2.5 rounded-full bg-[var(--accent)] text-[#f7f4ea] font-bold text-sm"
          >
            レポートを作成
          </button>
        </div>
      )}

      {!isWeeklyLoading && weeklyReport && (
        <div className="space-y-3">
          {weeklyReport.isFallback && (
            <p className="p-3 rounded-2xl text-xs" style={{ background: 'rgba(197,137,95,0.12)', border: '1px solid rgba(197,137,95,0.35)', color: '#a4683f' }}>
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
              {/* 本人が採用・言い換えたものをホームに出し、できた日をワンタップで残せる */}
              {focus && focus.text === weeklyReport.nextFocus ? (
                <p className="mt-3 text-xs font-bold text-[var(--primary)]">✓ 今週のフォーカスにしました（ホームで記録できます）</p>
              ) : focusEditing ? (
                <div className="mt-3">
                  <input
                    value={focusDraft}
                    onChange={(e) => setFocusDraft(e.target.value.slice(0, FOCUS_MAX_CHARS))}
                    className="w-full px-4 py-2.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    placeholder="自分の言葉で、小さな行動に"
                    aria-label="今週のフォーカス"
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => adoptFocus(focusDraft)}
                      disabled={!focusDraft.trim()}
                      className="flex-1 py-2 rounded-full bg-[var(--accent)] text-[#f7f4ea] text-xs font-bold disabled:opacity-40"
                    >
                      これにする
                    </button>
                    <button
                      onClick={() => setFocusEditing(false)}
                      className="px-4 py-2 rounded-full border border-[var(--border)] text-[var(--muted)] text-xs"
                    >
                      やめる
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => adoptFocus(weeklyReport.nextFocus)}
                    className="flex-1 py-2 rounded-full bg-[var(--accent)] text-[#f7f4ea] text-xs font-bold"
                  >
                    今週のフォーカスにする
                  </button>
                  <button
                    onClick={() => {
                      setFocusDraft(weeklyReport.nextFocus)
                      setFocusEditing(true)
                    }}
                    className="px-4 py-2 rounded-full border border-[var(--border)] text-[var(--muted)] text-xs"
                  >
                    言い換える
                  </button>
                </div>
              )}
              {focus && focus.text !== weeklyReport.nextFocus && !focusEditing && (
                <p className="mt-2 text-[11px] text-[var(--muted)]">いまのフォーカス: {focus.text}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
