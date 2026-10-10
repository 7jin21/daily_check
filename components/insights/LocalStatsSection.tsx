'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getSupabaseClient } from '@/lib/supabase'
import { moodEmoji } from '@/lib/constants'
import { dayOfWeek, formatJSTDate, subtractDays, todayJST } from '@/lib/jst'
import { hasWords, type StoredEntryText } from '@/lib/entry-merge'
import { MOOD_COLOR } from './shared'

interface LocalStats {
  recorded: number
  // 本人の言葉が残っている日（気分だけの記録は含まない）
  withWords: number
  totalDays: number
  moodDist: Record<number, number>
  topEmotions: { emotion: string; count: number }[]
  recentMoods: { date: string; mood: number }[]
  weekdayMoods: { label: string; avg: number; count: number }[]
  tagMoods: { tag: string; avg: number; diff: number; count: number }[]
  avgMood: number
}

/** 統計に使う diary_entries の列 */
type StatsRow = Partial<StoredEntryText> & {
  entry_date: string
  mood: number
  dominant_emotion: string | null
}

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

function moodColorFor(avg: number): string {
  const idx = Math.min(5, Math.max(1, Math.round(avg)))
  return MOOD_COLOR[idx]
}

/** 過去30日の記録（新しい順）から、画面に出す集計を作る */
function buildLocalStats(data: StatsRow[]): LocalStats {
  const moodDist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  const emotionCounts: Record<string, number> = {}
  const weekdayAgg: Record<number, { sum: number; count: number }> = {}
  const tagAgg: Record<string, { sum: number; count: number }> = {}
  let moodSum = 0
  let moodCount = 0
  let withWords = 0

  for (const e of data) {
    if (hasWords(e)) withWords++
    if (e.mood >= 1 && e.mood <= 5) {
      moodDist[e.mood]++
      moodSum += e.mood
      moodCount++
      // 曜日別（JST の暦で数える。端末のタイムゾーンでずれないように）
      const dow = dayOfWeek(e.entry_date)
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

  return {
    recorded: data.length,
    withWords,
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
  }
}

async function fetchLocalStats(): Promise<LocalStats | null> {
  const supabase = getSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // 今日を含む30日（JST の暦で数える。端末のタイムゾーンで1日ずれないように）
  const from = subtractDays(todayJST(), 29)

  // 言葉の列は「言葉つきの日」を数えるため。保存側（entry-save）と同じ列を見て、判定をそろえる
  const { data } = await supabase
    .from('diary_entries')
    .select('entry_date, mood, dominant_emotion, tags, events, challenges, gratitude, freeform, ai_draft, edited_draft')
    .eq('user_id', user.id)
    .gte('entry_date', from)
    .order('entry_date', { ascending: false })
    .limit(30)

  if (!data) return null
  return buildLocalStats(data as StatsRow[])
}

// 過去30日の記録から端末側で集計する統計（AI を待たずにすぐ出せる）
export default function LocalStatsSection() {
  const [localStats, setLocalStats] = useState<LocalStats | null>(null)

  useEffect(() => {
    fetchLocalStats()
      .then((stats) => { if (stats) setLocalStats(stats) })
      .catch(() => { /* ignore */ })
  }, [])

  if (!localStats) return null

  const maxMoodCount = Math.max(...Object.values(localStats.moodDist), 1)
  const recordRate = Math.round((localStats.recorded / localStats.totalDays) * 100)
  const wordsRate = Math.round((localStats.withWords / localStats.totalDays) * 100)

  return (
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
        {/* 気分だけの日も「続けた日」として上に数えつつ、本人の言葉が残った日を別に見せる。
            このアプリが一番大事にしているのは、あとで読み返せる自分の言葉だから */}
        <div className="flex items-end justify-between mt-4 mb-1.5">
          <span className="text-sm text-[var(--muted)]">
            うち言葉つき
            <span className="ml-1.5 text-lg font-bold text-[var(--foreground)] tabular-nums">{localStats.withWords}</span>
            <span className="text-xs text-[var(--muted-2)]">日</span>
          </span>
          <span className="text-sm font-semibold text-[var(--primary)] tabular-nums">{wordsRate}%</span>
        </div>
        <div className="h-1.5 bg-[var(--surface-secondary)] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--primary)] transition-all duration-500"
            style={{ width: `${wordsRate}%` }}
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
                <span className="text-xl w-8 flex-shrink-0 text-center">{moodEmoji(level)}</span>
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
            そのタグが付いた日の平均気分（全体平均 {localStats.avgMood} との差）。タップでその日記を一覧できます
          </p>
          <ul className="space-y-2">
            {localStats.tagMoods.map((t) => (
              <li key={t.tag}>
                {/* 根拠になった日記（そのタグの記録）を時系列で開ける */}
                <Link href={`/entries?tag=${encodeURIComponent(t.tag)}`} className="w-full flex items-center gap-3 !justify-start">
                  <span className="text-sm text-[var(--primary)] flex-1 min-w-0 truncate text-left">#{t.tag}</span>
                  <span className="text-xs text-[var(--muted-2)] tabular-nums">{t.count}日</span>
                  <span className="text-sm font-semibold text-[var(--foreground)] tabular-nums">{t.avg}</span>
                  <span
                    className="text-xs font-medium tabular-nums w-12 text-right"
                    style={{ color: t.diff >= 0 ? '#5a7350' : '#9c4a2f' }}
                  >
                    {t.diff >= 0 ? `+${t.diff}` : t.diff}
                  </span>
                  <span className="text-[var(--muted-2)]">›</span>
                </Link>
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
                  {formatJSTDate(e.date, { month: 'numeric', day: 'numeric' })}
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
  )
}
