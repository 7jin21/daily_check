'use client'

import { useEffect, useRef, type CSSProperties } from 'react'
import Link from 'next/link'
import Wbr from '@/components/ui/Wbr'
import { BellIcon } from '@/components/ui/icons'
import { moodColor } from '@/lib/constants'
import { formatJSTDate } from '@/lib/jst'
import './draft.css'

interface Props {
  entryDate: string
  mood: number | null
  merged: boolean // 同じ日の日記に追記した（前の言葉は残っている）
  isToday: boolean
  showReminderNudge: boolean
}

type Tone = 'low' | 'mid' | 'high'

/** 気分に合わせたことば。しんどい日に「保存しました！」と祝わない（「|」は折り返してよい文節の切れ目） */
function wordsFor(tone: Tone, merged: boolean, isToday: boolean): { title: string; sub: string } {
  if (merged) return { title: '追記しました。', sub: '前の言葉は、|そのまま|残っています。' }
  if (!isToday) return { title: 'この日の記録を、|残しました。', sub: '書き忘れた日も、|これで|埋まりました。' }
  if (tone === 'low') return { title: 'おつかれさまでした。', sub: 'しんどい日の|言葉も、|ちゃんと|残りました。' }
  if (tone === 'high') return { title: '今日を、|残しました。', sub: 'いい日の|言葉は、|いつか、|しんどい日の|支えに|なります。' }
  return { title: '今日を、|残しました。', sub: 'なんでもない|一日も、|あなたの|言葉で|残りました。' }
}

// 保存したあとの画面「水面に一滴」。その日の気分の色の一滴が水面に落ちて、波紋になって広がる。
// （以前は紙吹雪と「保存しました！」で、気分がとても悪い日にも同じように祝っていた）
// しんどい日は、ゆっくり落ちて波紋も少なく、ことばも労いに変える。
// ホームへ戻ると、その日の丸に色が落ちる（lib/save-echo.ts）。
export default function SavedView({ entryDate, mood, merged, isToday, showReminderNudge }: Props) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const tone: Tone = mood === null ? 'mid' : mood <= 2 ? 'low' : mood >= 4 ? 'high' : 'mid'
  const { title, sub } = wordsFor(tone, merged, isToday)

  // 読み上げで「保存できた」ことがすぐ伝わるよう、見出しに焦点を移す
  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true })
  }, [])

  const style = {
    '--drop': moodColor(mood),
    '--fall': tone === 'low' ? '1.1s' : '0.75s',
    '--impact': tone === 'low' ? '1.25s' : '0.9s',
  } as CSSProperties
  const rings = tone === 'low' ? 2 : 3

  return (
    <div className="dv-saved" data-tone={tone} style={style}>
      <div className="dv-saved-water" aria-hidden="true" />
      <span className="dv-bloom" aria-hidden="true" />
      {Array.from({ length: rings }, (_, i) => (
        <span key={i} className="dv-ring" style={{ '--i': i } as CSSProperties} aria-hidden="true" />
      ))}
      <span className="dv-drop" aria-hidden="true" />

      <div className="dv-saved-text">
        <p className="dv-saved-eyebrow">{formatJSTDate(entryDate, { month: 'long', day: 'numeric', weekday: 'short' })}の記録</p>
        <h1 ref={titleRef} tabIndex={-1} className="dv-saved-title">
          <Wbr text={title} />
        </h1>
        <p className="dv-saved-sub">
          <Wbr text={sub} />
        </p>
      </div>

      <div className="dv-saved-actions">
        <Link href={`/entries/${entryDate}`} className="btn btn-primary btn-block">
          日記を読む
        </Link>
        <Link href="/" className="btn btn-secondary btn-block">
          ホームに戻る
        </Link>
        {/* 記録の習慣化ナッジ: リマインダー未設定の場合のみ */}
        {showReminderNudge && (
          <Link href="/settings" className="btn-quiet">
            <BellIcon size={16} />
            夜にそっと知らせるリマインダーを設定する
          </Link>
        )}
      </div>
    </div>
  )
}
