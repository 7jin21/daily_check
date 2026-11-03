import type { CSSProperties, ReactNode } from 'react'
import Link from 'next/link'
import { MOODS, moodColor, moodLabel } from '@/lib/constants'
import type { HomeEntry, HomeStats } from '@/lib/home-model'
import { dayOfWeek, shortDate, subtractDays } from '@/lib/jst'
import { isValidPastDate } from '@/lib/checkin-rollover'
import { WEEKDAY_KANJI } from '@/lib/almanac'
import Phrase from '@/components/ui/Phrase'
import Reveal from './Reveal'

// ホームの和紙シートに並ぶセクション群（すべてサーバーで描画できる純粋な表示部品）

const moodVar = (mood: number | null | undefined) => ({ '--mood': moodColor(mood) }) as CSSProperties

export function Section({
  idx,
  title,
  meta,
  metaHref,
  children,
}: {
  idx: string
  title: string
  meta?: string
  metaHref?: string
  children: ReactNode
}) {
  return (
    <Reveal className="im-section">
      <section aria-label={title}>
        <header className="im-sec-head">
          <span className="im-sec-idx">{idx}</span>
          <h2 className="im-sec-title">{title}</h2>
          {meta &&
            (metaHref ? (
              <Link href={metaHref} className="im-sec-meta">
                {meta}
              </Link>
            ) : (
              <span className="im-sec-meta">{meta}</span>
            ))}
        </header>
        {children}
      </section>
    </Reveal>
  )
}

/** 月曜始まりの今週7日分の日付 */
export function weekDates(today: string): string[] {
  const dow = dayOfWeek(today) // 0=日
  const monday = subtractDays(today, dow === 0 ? 6 : dow - 1)
  return Array.from({ length: 7 }, (_, i) => subtractDays(monday, -i))
}

// ───────── この一週間 ─────────
export function WeekRipples({ today, entries }: { today: string; entries: HomeEntry[] }) {
  const byDate = new Map(entries.map((e) => [e.entry_date, e]))
  const dates = weekDates(today)

  return (
    <div className="im-week">
      {dates.map((date, i) => {
        const entry = byDate.get(date)
        const isToday = date === today
        const isFuture = date > today
        const state = entry ? 'recorded' : isFuture ? 'future' : 'empty'
        const href = entry
          ? `/entries/${date}`
          : isToday
            ? '/checkin'
            : isValidPastDate(date, today)
              ? `/checkin?date=${date}`
              : null
        const label = `${shortDate(date)}（${WEEKDAY_KANJI[dayOfWeek(date)]}）${
          entry ? `気分 ${moodLabel(entry.mood) ?? ''}` : isFuture ? '' : '記録なし'
        }`
        const body = (
          <>
            <span className="im-day-wd">{WEEKDAY_KANJI[dayOfWeek(date)]}</span>
            <span className="im-day-dot" data-state={state} style={{ ...moodVar(entry?.mood), '--i': i } as CSSProperties} />
            <span className="im-day-num">{Number(date.slice(8, 10))}</span>
          </>
        )
        return href ? (
          <Link key={date} href={href} className="im-day" data-today={isToday} data-date={date} aria-label={label}>
            {body}
          </Link>
        ) : (
          <div key={date} className="im-day" data-today={isToday} data-date={date} aria-label={label}>
            {body}
          </div>
        )
      })}
    </div>
  )
}

// ───────── 数字の帯 ─────────
/**
 * 連続記録のマス。途切れた日に大きな「0」を見せて責めないように、状態で出し分ける。
 * - 続いている → 連続 N日（昨日だけ空いていれば「昨日を書くと M日」も添える）
 * - 昨日だけ空いて途切れた → 戻せる日数を輪郭の数字で見せ、昨日の記録へ案内する（書き忘れ救済で連続は戻る）
 * - それ以外で途切れた → これまでの最長（できたことを思い出せるように）
 */
function StreakCell({ stats, yesterday }: { stats: HomeStats; yesterday: string }) {
  const backfill = `/checkin?date=${yesterday}`
  if (stats.streak > 0) {
    return (
      <div className="im-stat">
        <div className="im-label">連続</div>
        <div className="im-stat-value">
          {stats.streak}
          <span className="im-stat-unit">日</span>
        </div>
        {stats.restorable && (
          <Link href={backfill} className="im-stat-note">
            <Phrase text={`昨日を書くと${stats.restorable}日`} />
          </Link>
        )}
      </div>
    )
  }
  if (stats.restorable) {
    return (
      <Link
        href={backfill}
        className="im-stat"
        aria-label={`連続記録は昨日で途切れています。昨日の分を書けば ${stats.restorable}日 に戻ります`}
      >
        <div className="im-label">連続</div>
        <div className="im-stat-value" data-ghost="true">
          {stats.restorable}
          <span className="im-stat-unit">日</span>
        </div>
        <span className="im-stat-note">
          <Phrase text="昨日を書けば戻ります" />
        </span>
      </Link>
    )
  }
  if (stats.longest > 0) {
    return (
      <div className="im-stat">
        <div className="im-label">これまでの最長</div>
        <div className="im-stat-value">
          {stats.longest}
          <span className="im-stat-unit">日</span>
        </div>
        <span className="im-stat-note" data-quiet="true">今日から、また。</span>
      </div>
    )
  }
  return (
    <div className="im-stat">
      <div className="im-label">連続</div>
      <div className="im-stat-value">—</div>
    </div>
  )
}

export function StatsLine({ stats, yesterday }: { stats: HomeStats; yesterday: string }) {
  return (
    <Reveal className="im-section">
      <div className="im-stats">
        <StreakCell stats={stats} yesterday={yesterday} />
        <div className="im-stat">
          <div className="im-label">記録</div>
          <div className="im-stat-value">
            {stats.total}
            <span className="im-stat-unit">件</span>
          </div>
        </div>
        <div className="im-stat">
          <div className="im-label">平均の気分</div>
          <div className="im-stat-value">
            {stats.avgMood ? stats.avgMood.toFixed(1) : '—'}
            <span className="im-stat-unit">/5</span>
          </div>
        </div>
      </div>
    </Reveal>
  )
}

// ───────── 記録の軌跡（13週 × 7日） ─────────
const MONDAY_FIRST = [...WEEKDAY_KANJI.slice(1), WEEKDAY_KANJI[0]]

export function MoodTrace({ today, entries }: { today: string; entries: HomeEntry[] }) {
  const byDate = new Map(entries.map((e) => [e.entry_date, e.mood]))
  const start = subtractDays(weekDates(today)[0], 12 * 7)
  const weeks = Array.from({ length: 13 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => subtractDays(start, -(w * 7 + d)))
  )
  // 月の変わり目の週に「◯月」を出す
  const monthLabels = weeks.map((week, w) => {
    const first = week.find((d) => d.endsWith('-01'))
    if (first) return `${Number(first.slice(5, 7))}月`
    return w === 0 ? `${Number(week[0].slice(5, 7))}月` : ''
  })
  const since = subtractDays(today, 89)
  const recorded = Array.from(byDate.keys()).filter((d) => d >= since && d <= today).length

  return (
    <>
      <div className="im-trace" role="img" aria-label={`直近90日のうち${recorded}日を記録`}>
        <span />
        {monthLabels.map((l, w) => (
          <span key={`m${w}`} className="im-trace-month">{l}</span>
        ))}
        {MONDAY_FIRST.map((wd, d) => (
          <TraceRow key={wd} wd={wd} d={d} weeks={weeks} byDate={byDate} today={today} />
        ))}
      </div>
      <div className="im-trace-foot">
        <span className="im-trace-count">
          90日のうち<b>{recorded}</b>日
        </span>
        <span className="im-legend" aria-hidden="true">
          <span className="im-label" style={{ marginRight: 4 }}>沈む</span>
          {MOODS.map((m) => (
            <i key={m.value} style={moodVar(m.value)} />
          ))}
          <span className="im-label" style={{ marginLeft: 4 }}>晴れる</span>
        </span>
      </div>
    </>
  )
}

function TraceRow({
  wd,
  d,
  weeks,
  byDate,
  today,
}: {
  wd: string
  d: number
  weeks: string[][]
  byDate: Map<string, number>
  today: string
}) {
  return (
    <>
      <span className="im-trace-wd">{d % 2 === 0 ? wd : ''}</span>
      {weeks.map((week, w) => {
        const date = week[d]
        if (date > today) return <span key={date} className="im-trace-cell" />
        const mood = byDate.get(date)
        return (
          <span
            key={date}
            className="im-trace-cell"
            data-state={mood ? 'recorded' : 'empty'}
            data-today={date === today}
            style={{ ...moodVar(mood), '--i': w * 2 + d } as CSSProperties}
          >
            <i />
          </span>
        )
      })}
    </>
  )
}

// ───────── あの日の自分 ─────────
export function Flashbacks({ items }: { items: { label: string; entry: HomeEntry }[] }) {
  return (
    <div>
      {items.map(({ label, entry }) => (
        <Link key={entry.id} href={`/entries/${entry.entry_date}?now=1`} className="im-flash" style={moodVar(entry.mood)}>
          <span className="im-flash-bar" />
          <span>
            <span className="im-label">
              {label}・{entry.entry_date.split('-').join('.')}
            </span>
            <span className="im-flash-text">
              <Phrase text={entry.summary || entry.dominant_emotion || 'この日の記録を読む'} />
            </span>
            {/* 当時の本文はそのままに、今の見方を書き足せる */}
            <span className="im-flash-now">今は、どう思う？</span>
          </span>
          <span className="im-chevron" aria-hidden="true">›</span>
        </Link>
      ))}
    </div>
  )
}

// ───────── 最近の記録 ─────────
export function RecentList({ entries }: { entries: HomeEntry[] }) {
  return (
    <div>
      {entries.map((e) => (
        <Link key={e.id} href={`/entries/${e.entry_date}`} className="im-row" style={moodVar(e.mood)}>
          <span className="im-row-date">
            <span className="im-row-day">{Number(e.entry_date.slice(8, 10))}</span>
            <span className="im-row-wd im-label">
              <i />
              {WEEKDAY_KANJI[dayOfWeek(e.entry_date)]}
            </span>
          </span>
          <span style={{ minWidth: 0 }}>
            <span className="im-row-text">
              <Phrase text={e.summary || e.dominant_emotion || `気分「${moodLabel(e.mood) ?? '—'}」だけの記録`} />
            </span>
            {e.tags?.length > 0 && (
              <span className="im-row-tags">
                {e.tags.slice(0, 4).map((t) => `#${t}`).join('  ')}
              </span>
            )}
          </span>
        </Link>
      ))}
    </div>
  )
}
