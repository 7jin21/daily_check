'use client'

import { useState } from 'react'
import { formatJSTDate } from '@/lib/jst'
import { moodLabel } from '@/lib/constants'
import { moodLight, moonPhasePath } from '@/lib/state-glyph'
import { phrasesLite } from '@/components/ui/PhraseLite'
import { ImageIcon } from '@/components/ui/icons'

interface Props {
  date: string
  mood: number | null
  summary: string | null
  dominantEmotion: string | null
  tags: string[]
}

// 共有用の画像は、テーマ（ライト／ダーク）に関係なくいつも和紙の上に刷る。
// そのため紙と墨の色はここに置く（app/globals.css の :root のライトの値から: 紙 --surface・墨 --foreground・
// --muted・--faint・タグ --primary とその 10%）。罫だけは、縮小された画像でも見えるよう --hairline（0.12）より少し濃い。
// 気分の色だけは CSS 変数から読む。
const PAPER = {
  top: '#fbf9f3', bottom: '#f1ecdf', ink: '#24271f', muted: '#615e50', faint: '#a19c86',
  hairline: 'rgba(36,39,31,0.14)', tag: '#536c44', tagBg: 'rgba(83,108,68,0.1)',
}

const MINCHO = '"Shippori Mincho", "Hiragino Mincho ProN", "Yu Mincho", serif'
const GARAMOND = '"Cormorant Garamond", Georgia, serif'

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** 文節の切れ目（PhraseLite）で折り返して、最大 lineLimit 行まで描く。1つの文節が幅を超えるときだけ文字で折る */
function wrapByPhrase(
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
  const push = (l: string) => {
    if (lines.length < lineLimit + 1) lines.push(l)
  }
  for (const chunk of phrasesLite(text)) {
    if (ctx.measureText(line + chunk).width <= maxWidth) {
      line += chunk
      continue
    }
    if (line) push(line)
    line = ''
    // 文節そのものが長すぎるときは文字で折る
    for (const ch of chunk) {
      if (ctx.measureText(line + ch).width > maxWidth && line) {
        push(line)
        line = ch
      } else line += ch
    }
  }
  if (line) push(line)
  const shown = lines.slice(0, lineLimit)
  if (lines.length > lineLimit) {
    const last = shown[lineLimit - 1]
    shown[lineLimit - 1] = last.length > 1 ? `${last.slice(0, -1)}…` : last
  }
  shown.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight))
}

async function buildCardBlob(props: Props): Promise<Blob | null> {
  const W = 1080
  const H = 1350
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const body = props.summary || props.dominantEmotion || '今日も一日、おつかれさまでした'
  const dateStr = formatJSTDate(props.date, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
  // 画面で使っている書体を、使う文字の分だけ読み込んでから描く（未読み込みだと代わりの書体で刷られる）
  try {
    await Promise.all([
      document.fonts.load(`500 52px ${MINCHO}`, body + dateStr + props.tags.join('')),
      document.fonts.load(`italic 500 40px ${GARAMOND}`, 'Inner Mirror'),
    ])
  } catch {
    // 読み込めなければ代わりの書体で描く
  }

  // 和紙
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, PAPER.top)
  bg.addColorStop(1, PAPER.bottom)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // ワードマーク
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = PAPER.ink
  ctx.font = `italic 500 40px ${GARAMOND}`
  ctx.fillText('Inner Mirror', 96, 150)

  // 日付
  ctx.fillStyle = PAPER.muted
  ctx.font = `500 34px ${MINCHO}`
  ctx.fillText(dateStr, 96, 214)

  // 気分の月（チェックインで選んだときと同じ形・同じ色）
  const lit = moodLight(props.mood)
  if (lit !== null) {
    const color = getComputedStyle(document.documentElement).getPropertyValue(`--mood-${props.mood}`).trim() || PAPER.faint
    const cx = W - 200
    const cy = 176
    const r = 72
    ctx.save()
    ctx.translate(cx, cy)
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.lineWidth = 2
    ctx.strokeStyle = color
    ctx.globalAlpha = 0.5
    ctx.stroke()
    ctx.globalAlpha = 1
    ctx.fillStyle = color
    ctx.fill(new Path2D(moonPhasePath(lit, r)))
    ctx.restore()
    ctx.fillStyle = PAPER.muted
    ctx.font = `500 26px ${MINCHO}`
    ctx.textAlign = 'center'
    ctx.fillText(moodLabel(props.mood) ?? '', cx, cy + r + 50)
    ctx.textAlign = 'left'
  }

  // 罫線
  ctx.fillStyle = PAPER.hairline
  ctx.fillRect(96, 360, W - 192, 2)

  // 本文（その日の一文）
  ctx.fillStyle = PAPER.ink
  ctx.font = `500 52px ${MINCHO}`
  wrapByPhrase(ctx, body, 96, 480, W - 192, 92, 6)

  // タグ
  let tx = 96
  const ty = H - 260
  ctx.font = `500 30px ${MINCHO}`
  props.tags.slice(0, 4).forEach((tag) => {
    const label = `#${tag}`
    const w = ctx.measureText(label).width + 48
    if (tx + w > W - 96) return
    ctx.fillStyle = PAPER.tagBg
    roundRect(ctx, tx, ty, w, 60, 30)
    ctx.fill()
    ctx.fillStyle = PAPER.tag
    ctx.fillText(label, tx + 24, ty + 41)
    tx += w + 16
  })

  // 結び
  ctx.fillStyle = PAPER.faint
  ctx.fillRect(96, H - 150, 64, 2)
  ctx.fillStyle = PAPER.muted
  ctx.font = `500 28px ${MINCHO}`
  ctx.fillText('映して、ととのえる。', 96, H - 96)

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
    <button type="button" onClick={handleShare} disabled={isSharing} className="btn btn-secondary flex-1">
      <ImageIcon size={18} />
      {isSharing ? '画像を作っています…' : '画像でシェア'}
    </button>
  )
}
