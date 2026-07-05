'use client'

import { useState } from 'react'

interface Props {
  date: string
  mood: number | null
  summary: string | null
  dominantEmotion: string | null
  tags: string[]
}

const MOOD_EMOJI: Record<number, string> = { 1: '😞', 2: '😕', 3: '😐', 4: '🙂', 5: '😄' }
const MOOD_COLOR: Record<number, string> = {
  1: '#b5654a', 2: '#c5895f', 3: '#cdbf9a', 4: '#9caa7e', 5: '#6f8a5f',
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** 本文を maxWidth に収まるよう改行し、最大 lineLimit 行まで描画する */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  lineLimit: number
) {
  const lines: string[] = []
  let line = ''
  for (const ch of text) {
    const test = line + ch
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = ch
      if (lines.length === lineLimit) break
    } else {
      line = test
    }
  }
  if (lines.length < lineLimit && line) lines.push(line)
  if (lines.length === lineLimit) {
    const last = lines[lineLimit - 1]
    lines[lineLimit - 1] = last.length > 1 ? `${last.slice(0, -1)}…` : last
  }
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight))
}

async function buildCardBlob(props: Props): Promise<Blob | null> {
  const W = 1080
  const H = 1350
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  // 紙面（クリーム系グラデーション。cta-paper と同系統）
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#fbf9f2')
  bg.addColorStop(1, '#f1eddd')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  const moodColor = (props.mood && MOOD_COLOR[props.mood]) || '#8ba3b5'
  ctx.fillStyle = moodColor
  ctx.fillRect(0, 0, W, 16)

  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#ab8b4e'
  ctx.font = '600 30px Georgia, serif'
  ctx.fillText('INNER MIRROR', 80, 150)

  const d = new Date(`${props.date}T12:00:00+09:00`)
  const dateStr = d.toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  })
  ctx.fillStyle = '#32362a'
  ctx.font = 'bold 50px Georgia, serif'
  ctx.fillText(dateStr, 80, 220)

  if (props.mood) {
    ctx.font = '170px sans-serif'
    ctx.fillText(MOOD_EMOJI[props.mood], 80, 430)
  }

  ctx.fillStyle = '#32362a'
  ctx.font = '46px Georgia, serif'
  wrapText(ctx, props.summary || props.dominantEmotion || '今日も一日、お疲れさまでした', 80, 560, W - 160, 64, 5)

  let tx = 80
  const ty = H - 230
  ctx.font = '32px Georgia, serif'
  props.tags.slice(0, 4).forEach((tag) => {
    const label = `#${tag}`
    const w = ctx.measureText(label).width + 48
    ctx.fillStyle = 'rgba(107,135,86,0.15)'
    roundRect(ctx, tx, ty, w, 60, 30)
    ctx.fill()
    ctx.fillStyle = '#5f7a4c'
    ctx.fillText(label, tx + 24, ty + 41)
    tx += w + 16
  })

  ctx.fillStyle = '#8b8877'
  ctx.font = '28px Georgia, serif'
  ctx.fillText('毎日30秒のAI日記', 80, H - 80)

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'))
}

export default function ShareEntryButton(props: Props) {
  const [isSharing, setIsSharing] = useState(false)

  const handleShare = async () => {
    if (isSharing) return
    setIsSharing(true)
    try {
      const blob = await buildCardBlob(props)
      if (!blob) return
      const file = new File([blob], `inner-mirror-${props.date}.png`, { type: 'image/png' })

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Inner Mirror', text: 'わたしの今日の記録' })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = file.name
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        console.error('Share error:', err)
      }
    } finally {
      setIsSharing(false)
    }
  }

  return (
    <button
      onClick={handleShare}
      disabled={isSharing}
      className="flex-1 py-3 text-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] text-sm font-medium active:scale-95 transition-transform disabled:opacity-50"
    >
      {isSharing ? '作成中…' : '🖼 画像でシェア'}
    </button>
  )
}
