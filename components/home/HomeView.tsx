import Link from 'next/link'
import type { HomeModel } from '@/lib/home-model'
import MirrorHero from './MirrorHero'
import MirrorCTA from './MirrorCTA'
import StreakCelebration from './StreakCelebration'
import Reveal from './Reveal'
import { Section, WeekRipples, StatsLine, MoodTrace, Flashbacks, RecentList, weekDates } from './HomeSections'
import MoodCurve from './MoodCurve'
import QuickMemo from './QuickMemo'
import FocusLine from './FocusLine'
import './home.css'

// ホーム画面の描画（データは app/page.tsx か開発用プレビューから受け取る）

const GREETING = { dawn: 'おはようございます', day: 'こんにちは', dusk: 'おつかれさまです', night: 'こんばんは' } as const

const short = (d: string) => `${Number(d.slice(5, 7))}.${Number(d.slice(8, 10))}`

function Colophon() {
  return (
    <footer className="im-colophon">
      <div className="im-colophon-mark">Inner Mirror</div>
      <div className="im-colophon-line">映して、ととのえる。</div>
    </footer>
  )
}

export default function HomeView({ model, now }: { model: HomeModel; now: Date }) {
  const { today, period, entries, stats, todayEntry, missedYesterday, yesterday, flashbacks, recentEntries } = model
  const week = weekDates(today)
  let n = 0
  const idx = () => String(++n).padStart(2, '0')
  // 「気分だけ」の記録（本文・要約がまだない）
  const moodOnlyToday = !!todayEntry && !todayEntry.summary && !todayEntry.dominant_emotion

  return (
    <div className="im-home">
      <StreakCelebration streak={stats.streak} />

      {/* 記録済みの日は空を低くして、読み返し・数字をすぐ見られるようにする */}
      <MirrorHero today={today} period={period} now={now} compact={!!todayEntry}>
        <MirrorCTA
          today={today}
          greeting={GREETING[period]}
          todaySummary={todayEntry?.summary || todayEntry?.dominant_emotion || null}
          hasTodayEntry={!!todayEntry}
          moodOnly={moodOnlyToday}
          missedYesterday={missedYesterday ? yesterday : null}
        />
      </MirrorHero>

      <div className="im-sheet">
        <FocusLine today={today} />

        {/* 日中のひとこと（今日の言葉がまだ日記になっていない間だけ） */}
        {(!todayEntry || moodOnlyToday) && (
          <Section idx={idx()} title="今日のひとこと" meta="夜の日記にまとめられます">
            <QuickMemo today={today} />
          </Section>
        )}

        <Section idx={idx()} title="この一週間" meta={`${short(week[0])} — ${short(week[6])}`}>
          <WeekRipples today={today} entries={entries} />
        </Section>

        <StatsLine stats={stats} />

        {entries.length > 0 && (
          <Section idx={idx()} title="記録の軌跡" meta="直近90日">
            <MoodTrace today={today} entries={entries} />
          </Section>
        )}

        {entries.length > 1 && (
          <Section idx={idx()} title="気分の波" meta={`直近${Math.min(14, entries.length)}回`}>
            <MoodCurve entries={entries} />
          </Section>
        )}

        {flashbacks.length > 0 && (
          <Section idx={idx()} title="あの日の自分">
            <Flashbacks items={flashbacks} />
          </Section>
        )}

        {recentEntries.length > 0 && (
          <Section idx={idx()} title="最近の記録" meta="すべて見る ›" metaHref="/entries">
            <RecentList entries={recentEntries} />
          </Section>
        )}

        <Colophon />
      </div>
    </div>
  )
}

/** 記録が1件もないとき（初回）のホーム */
export function OnboardingView({ model, now }: { model: HomeModel; now: Date }) {
  const steps = [
    { title: '気分をタップする', body: '必須は気分とエネルギーの2つだけ。30秒で終わります。' },
    { title: 'ひとこと書く', body: '話すだけでも大丈夫。あなたの言葉のまま、AI が読みやすく整えます。' },
    { title: '続けるほど、自分が見えてくる', body: '気分の波や、大切にしているものが少しずつ浮かび上がります。' },
  ]
  return (
    <div className="im-home">
      <MirrorHero today={model.today} period={model.period} now={now}>
        <p className="im-cta-eyebrow">ようこそ</p>
        <p className="im-cta-title">
          今日を映す、<br />三十秒の日記。
        </p>
        <div className="im-cta-row">
          <Link href="/checkin" className="im-pill">
            最初の記録をする
            <span className="im-pill-arrow">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 8h9.5M8.5 3.5 13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </Link>
        </div>
      </MirrorHero>
      <div className="im-sheet">
        <Reveal className="im-section">
          <header className="im-sec-head">
            <span className="im-sec-idx">01</span>
            <h2 className="im-sec-title">使いかた</h2>
            <span className="im-sec-meta">入力は自動で保存されます</span>
          </header>
          <ol>
            {steps.map((s, i) => (
              <li key={s.title} className="im-row" style={{ gridTemplateColumns: '46px 1fr' }}>
                <span className="im-row-day" style={{ textAlign: 'center' }}>{i + 1}</span>
                <span>
                  <span className="im-sec-title" style={{ fontSize: 16, display: 'block' }}>{s.title}</span>
                  <span className="im-row-tags" style={{ display: 'block', whiteSpace: 'normal', fontSize: 13, lineHeight: 1.8 }}>
                    {s.body}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </Reveal>
        <Colophon />
      </div>
    </div>
  )
}
