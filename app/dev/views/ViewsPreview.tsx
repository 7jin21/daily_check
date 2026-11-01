'use client'

import { useEffect, useState } from 'react'
import { GeneratingView, ReadingView } from '@/components/draft/WaitingViews'
import SavedView from '@/components/draft/SavedView'
import { subtractDays } from '@/lib/jst'

const MEMO = '朝ジムで30分走った。会議が長引いて疲れた。夜は友達とラーメン。前提を確認してほしかった'
const DRAFT =
  '朝はジムで30分走った。会議が長引いて少し疲れたけれど、夜は友達とラーメンを食べて元気が出た。\n\n前提を確認してほしかった、とも思う。'

/** 清書が少しずつ届く様子をまねる */
function StreamingPreview() {
  const [n, setN] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setN((v) => (v >= DRAFT.length ? v : v + 2)), 70)
    return () => clearInterval(t)
  }, [])
  return <GeneratingView text={DRAFT.slice(0, n)} original={MEMO} onCancel={() => setN(0)} />
}

export default function ViewsPreview({
  view,
  mood,
  merged,
  past,
}: {
  view: 'reading' | 'generating' | 'saved'
  mood: number
  merged: boolean
  past: boolean
}) {
  if (view === 'reading') return <ReadingView />
  if (view === 'saved') {
    const today = new Date().toISOString().slice(0, 10)
    return (
      <SavedView
        entryDate={past ? subtractDays(today, 2) : today}
        mood={mood}
        merged={merged}
        isToday={!past}
        showReminderNudge
      />
    )
  }
  return <StreamingPreview />
}
