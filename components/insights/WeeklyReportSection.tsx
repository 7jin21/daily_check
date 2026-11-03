'use client'

import { useState, useEffect } from 'react'
import { apiPost } from '@/lib/api-client'
import { readInsightsCache, writeInsightsCache } from '@/lib/insights-session'
import { useInsightsSession } from './InsightsSessionBoundary'
import { todayJST } from '@/lib/jst'
import { doneInLastWeek, FOCUS_MAX_CHARS, isFocusActive, loadFocus, saveFocus, type Focus } from '@/lib/focus'
import { ReadingBlock, requestError, SectionHeader } from './shared'
import { AlertIcon, CheckIcon, MirrorMark } from '@/components/ui/icons'
import type { WeeklyReport } from '@/app/api/weekly-report/route'

/** ふり返りの小さなカード。色は気分のトークンから（ハイライト＝晴れ、乗り越えたこと＝沈みかけ、など） */
function ReportCard({ label, tone, children }: { label: string; tone: string; children: React.ReactNode }) {
  return (
    <div
      className="card"
      style={{
        background: `color-mix(in srgb, ${tone} 9%, var(--surface))`,
        borderColor: `color-mix(in srgb, ${tone} 30%, transparent)`,
      }}
    >
      <p className="label-ui mb-1.5" style={{ color: 'var(--foreground)' }}>
        <span aria-hidden="true" className="inline-block w-2 h-2 rounded-full mr-2 align-middle" style={{ background: tone }} />
        {label}
      </p>
      {children}
    </div>
  )
}

const WEEKLY_CACHE_TTL = 6 * 60 * 60 * 1000

function isValidWeeklyReport(value: unknown): value is WeeklyReport {
  if (!value || typeof value !== 'object') return false
  const report = value as Record<string, unknown>
  return ['narrative', 'highlight', 'challenge', 'nextFocus', 'weekMood'].every((key) => typeof report[key] === 'string') &&
    typeof report.entryCount === 'number' && typeof report.avgMood === 'number'
}

// 「今週の振り返り」: 直近7日の週次レポートと、来週のフォーカスの採用
export default function WeeklyReportSection() {
  const { userId, session } = useInsightsSession()
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReport | null>(null)
  const [isWeeklyLoading, setIsWeeklyLoading] = useState(false)
  const [weeklyError, setWeeklyError] = useState<string | null>(null)
  const [weeklyCachedAt, setWeeklyCachedAt] = useState<number | null>(null)
  // 採用した「今週のフォーカス」（ホームでワンタップ記録できる）
  const [focus, setFocus] = useState<Focus | null>(null)
  const [focusEditing, setFocusEditing] = useState(false)
  const [focusDraft, setFocusDraft] = useState('')

  useEffect(() => {
    const cached = readInsightsCache('weekly', userId, WEEKLY_CACHE_TTL, isValidWeeklyReport)
    setWeeklyReport(cached?.result ?? null)
    setWeeklyCachedAt(cached?.timestamp ?? null)
    const f = loadFocus()
    if (isFocusActive(f, todayJST())) setFocus(f)
    return () => session.cancel('weekly')
  }, [session, userId])

  const adoptFocus = (text: string) => {
    const t = text.trim().slice(0, FOCUS_MAX_CHARS)
    if (!t) return
    const next: Focus = { text: t, adoptedAt: todayJST(), doneDates: [] }
    saveFocus(next)
    setFocus(next)
    setFocusEditing(false)
  }

  const loadWeeklyReport = async () => {
    const request = session.begin('weekly', userId)
    if (!request) return
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
        { signal: request.signal }
      )
      if (!request.isCurrent()) return
      if ('status' in result) {
        setWeeklyError(result.status === 'no_data' ? '今週の記録がありません' : '取得に失敗しました')
      } else if (!isValidWeeklyReport(result)) {
        setWeeklyError('レポートを読み取れませんでした。もう一度お試しください')
      } else {
        const now = Date.now()
        // フォールバック（AI不通時の簡易版）はキャッシュしない — 次回は本物を試す
        if (!result.isFallback) {
          writeInsightsCache('weekly', request, result, now)
        }
        setWeeklyReport(result)
        setWeeklyCachedAt(now)
      }
    } catch (err) {
      if (request.isActive()) setWeeklyError(requestError(request, err, '取得に失敗しました'))
    } finally {
      if (request.isActive()) setIsWeeklyLoading(false)
      request.finish()
    }
  }

  return (
    <div>
      <SectionHeader
        title="今週の振り返り"
        actionLabel={isWeeklyLoading ? '書いています…' : weeklyReport ? '更新する' : 'レポートを作る'}
        busy={isWeeklyLoading}
        cachedAt={weeklyCachedAt}
        onAction={loadWeeklyReport}
      />

      {isWeeklyLoading && <ReadingBlock message="今週の日記を、ふり返っています" className="py-10" />}

      {!isWeeklyLoading && weeklyError && (
        <div className="card text-center py-6">
          <p className="text-[var(--muted)] text-sm">{weeklyError}</p>
        </div>
      )}

      {!isWeeklyLoading && !weeklyReport && !weeklyError && (
        <div className="card text-center py-8">
          <MirrorMark size={40} className="empty-mark" />
          <p className="font-mincho font-semibold text-[var(--foreground)]">今週を、ふり返る</p>
          <p className="text-sm text-[var(--muted)] mt-1 mb-5">直近7日間の日記から、一週間の物語を書きます</p>
          <button type="button" onClick={loadWeeklyReport} className="btn btn-primary btn-sm">
            レポートを作る
          </button>
        </div>
      )}

      {!isWeeklyLoading && weeklyReport && (
        <div className="space-y-3">
          {weeklyReport.isFallback && (
            <div className="notice" data-tone="warn" role="status">
              <AlertIcon size={18} />
              <p>AI レポートを作れなかったため、記録データからの簡易版を表示しています。「更新する」で再試行できます。</p>
            </div>
          )}
          <div className="card">
            <div className="flex items-baseline gap-2 mb-3 flex-wrap">
              <span className="label-ui">今週のキーワード</span>
              <span className="font-mincho font-semibold text-[var(--foreground)]">{weeklyReport.weekMood}</span>
              <span className="ml-auto text-xs font-ui text-[var(--muted-2)]">
                {weeklyReport.entryCount}件 / 平均気分 {weeklyReport.avgMood}
              </span>
            </div>
            <p className="font-mincho text-[0.9375rem] text-[var(--foreground)] leading-loose prose-ja">
              {weeklyReport.narrative}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {weeklyReport.focusReview && (
              <ReportCard label="先週のフォーカスは" tone="var(--mood-3)">
                <p className="font-mincho text-sm leading-relaxed text-[var(--foreground)]">{weeklyReport.focusReview}</p>
              </ReportCard>
            )}
            <ReportCard label="今週のハイライト" tone="var(--mood-5)">
              <p className="font-mincho text-sm leading-relaxed text-[var(--foreground)]">{weeklyReport.highlight}</p>
            </ReportCard>
            <ReportCard label="乗り越えたこと" tone="var(--mood-2)">
              <p className="font-mincho text-sm leading-relaxed text-[var(--foreground)]">{weeklyReport.challenge}</p>
            </ReportCard>
            <ReportCard label="来週のフォーカス" tone="var(--gold)">
              <p className="font-mincho text-sm leading-relaxed text-[var(--foreground)]">{weeklyReport.nextFocus}</p>
              {/* 本人が採用・言い換えたものをホームに出し、できた日をワンタップで残せる */}
              {focus && focus.text === weeklyReport.nextFocus ? (
                <p className="mt-3 flex items-center gap-1.5 text-xs font-bold font-ui text-[var(--primary)]">
                  <CheckIcon size={15} />
                  今週のフォーカスにしました（ホームで記録できます）
                </p>
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
                    <button type="button" onClick={() => adoptFocus(focusDraft)} disabled={!focusDraft.trim()} className="btn btn-primary btn-sm flex-1">
                      これにする
                    </button>
                    <button type="button" onClick={() => setFocusEditing(false)} className="btn btn-secondary btn-sm">
                      やめる
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 mt-3">
                  <button type="button" onClick={() => adoptFocus(weeklyReport.nextFocus)} className="btn btn-primary btn-sm flex-1">
                    今週のフォーカスにする
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFocusDraft(weeklyReport.nextFocus)
                      setFocusEditing(true)
                    }}
                    className="btn btn-secondary btn-sm"
                  >
                    言い換える
                  </button>
                </div>
              )}
              {focus && focus.text !== weeklyReport.nextFocus && !focusEditing && (
                <p className="mt-2 text-[0.6875rem] text-[var(--muted)]">いまのフォーカス: {focus.text}</p>
              )}
            </ReportCard>
          </div>
        </div>
      )}
    </div>
  )
}
