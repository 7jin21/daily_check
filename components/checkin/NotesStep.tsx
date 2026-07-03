'use client'

import { useEffect, useState } from 'react'
import { useCheckinStore } from '@/stores/checkin'
import TextStep from './TextStep'
import { apiGet } from '@/lib/api-client'
import { hapticTap } from '@/lib/haptics'

// チェックイン2画面目: テキスト4欄を1画面に集約。
// 「出来事」は常時表示、残り3欄は折りたたみ（値があれば自動で開く）。
// Google Calendar の当日予定をワンタップで「出来事」に挿入できる。

interface CalendarEvent {
  id: string
  title: string
  startTime: string | null
  endTime: string | null
  isAllDay: boolean
}

const MAX_CHARS = 500

type OptionalField = 'challenges' | 'gratitude' | 'freeform'

const OPTIONAL_SECTIONS: { id: OptionalField; label: string; placeholder: string }[] = [
  { id: 'challenges', label: '困ったこと・課題', placeholder: '問題・悩み・不安など...' },
  { id: 'gratitude', label: '感謝できること', placeholder: '小さなことでも大丈夫...' },
  { id: 'freeform', label: '自由メモ', placeholder: '思ったこと、気づいたこと、なんでも...' },
]

export default function NotesStep() {
  const {
    events,
    challenges,
    gratitude,
    freeform,
    targetDate,
    setEvents,
    setChallenges,
    setGratitude,
    setFreeform,
  } = useCheckinStore()

  const values: Record<OptionalField, string> = { challenges, gratitude, freeform }
  const setters: Record<OptionalField, (v: string) => void> = {
    challenges: setChallenges,
    gratitude: setGratitude,
    freeform: setFreeform,
  }

  // 値が入っている欄は最初から開いておく
  const [openSections, setOpenSections] = useState<Record<OptionalField, boolean>>({
    challenges: !!challenges.trim(),
    gratitude: !!gratitude.trim(),
    freeform: !!freeform.trim(),
  })

  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [calendarInserted, setCalendarInserted] = useState(false)

  // 当日の予定を取得（過去日付の記録では「今日の予定」はノイズなので出さない）
  useEffect(() => {
    if (targetDate) return
    let cancelled = false
    apiGet<{ events?: CalendarEvent[] }>('/api/calendar/today')
      .then((res) => {
        if (!cancelled && Array.isArray(res.events) && res.events.length > 0) {
          setCalendarEvents(res.events)
        }
      })
      .catch(() => { /* カレンダー未連携・失敗は静かに無視 */ })
    return () => { cancelled = true }
  }, [targetDate])

  const insertCalendarEvents = () => {
    hapticTap()
    const lines = calendarEvents
      .map((e) => {
        const time =
          e.isAllDay || !e.startTime
            ? '終日'
            : new Date(e.startTime).toLocaleTimeString('ja-JP', {
                timeZone: 'Asia/Tokyo',
                hour: '2-digit',
                minute: '2-digit',
              })
        return `・${e.title}（${time}）`
      })
      .join('\n')
    const next = events.trim() ? `${events}\n${lines}` : `今日の予定:\n${lines}`
    setEvents(next.slice(0, MAX_CHARS))
    setCalendarInserted(true)
  }

  const toggleSection = (id: OptionalField) => {
    hapticTap()
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="space-y-5 pb-2">
      {/* 出来事（メイン欄） */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-[var(--muted)]">今日あったこと</p>
          {calendarEvents.length > 0 && !calendarInserted && (
            <button
              type="button"
              onClick={insertCalendarEvents}
              className="text-xs px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--primary)] font-medium active:scale-95 transition-transform"
            >
              📅 今日の予定を挿入（{calendarEvents.length}件）
            </button>
          )}
        </div>
        <TextStep
          value={events}
          onChange={setEvents}
          placeholder="出来事・行動・会った人など..."
          rows={4}
        />
      </section>

      {/* 任意の3欄（折りたたみ） */}
      <div className="space-y-2.5">
        {OPTIONAL_SECTIONS.map(({ id, label, placeholder }) => {
          const isOpen = openSections[id]
          const value = values[id]
          return (
            <section key={id} className="border border-[var(--border)] rounded-[3px] bg-[var(--surface)]">
              <button
                type="button"
                onClick={() => toggleSection(id)}
                className="w-full flex items-center justify-between px-4 py-3.5 text-left active:opacity-70"
                aria-expanded={isOpen}
              >
                <span className="text-sm font-medium text-[var(--foreground)]">
                  {label}
                  {!isOpen && value.trim() && (
                    <span className="ml-2 text-xs text-[var(--muted-2)] font-normal">
                      {value.trim().slice(0, 18)}{value.trim().length > 18 ? '…' : ''}
                    </span>
                  )}
                </span>
                <span className="text-[var(--muted-2)] text-lg leading-none">{isOpen ? '−' : '+'}</span>
              </button>
              {isOpen && (
                <div className="px-3 pb-3 animate-fade-in">
                  <TextStep
                    value={value}
                    onChange={setters[id]}
                    placeholder={placeholder}
                    rows={3}
                    showHint={false}
                  />
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
