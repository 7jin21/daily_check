'use client'

import { useDeferredValue, useEffect, useMemo, useRef } from 'react'
import { analyzeKept } from '@/lib/draft-compose'
import InkRings from '@/components/ui/InkRings'
import './draft.css'

// 下書き画面の待ち時間の表示（内省の問いを待つ間・清書の生成中）

/** 内省の問いを待っている間（先読み済みならほぼ出ない。最大7秒で清書へ進む） */
export function ReadingView() {
  return (
    <div className="dv-wait" role="status">
      <InkRings />
      <p className="dv-wait-title">今日の記録を、読んでいます</p>
    </div>
  )
}

type Kind = 'o' | 'a' | 'j' // 本人の言葉 / AI が足した言葉 / つなぎの助詞

/** 書かれたばかりで、まだどちらの言葉か決まらない末尾の文字数（3文字の並びで本人の言葉かを判定するため） */
const WET_TAIL = 3

/**
 * 清書の本文を一文字ずつ。本人の言葉は墨のまま、AI が足した言葉には金の下線。
 * 判定は下書き画面の「あなたの言葉 ◯%」と同じ analyzeKept（メモと突き合わせる。AI は使わない）。
 */
function InkText({ text, original }: { text: string; original: string }) {
  // 文字が速く届いても入力や描画を詰まらせないよう、判定は少し遅れてよい
  const deferred = useDeferredValue(text)
  const { chars, kinds } = useMemo(() => {
    const chars = Array.from(deferred)
    const kinds: Kind[] = new Array(chars.length).fill('o')
    if (original.trim()) {
      let i = 0
      for (const seg of analyzeKept(original, deferred).segments) {
        const n = Array.from(seg.text).length
        const k: Kind = seg.added ? (seg.connector ? 'j' : 'a') : 'o'
        for (let j = 0; j < n; j++) kinds[i + j] = k
        i += n
      }
    }
    return { chars, kinds }
  }, [deferred, original])

  const wetFrom = Math.max(0, chars.length - WET_TAIL)
  return (
    <p className="dv-ink prose-ja">
      {chars.map((c, i) => (
        <span key={i} className={i >= wetFrom ? 'w' : kinds[i]}>
          {c}
        </span>
      ))}
    </p>
  )
}

/** 清書の生成中。届いた文字があれば、書かれていく様子をそのまま見せる */
export function GeneratingView({ text, original, onCancel }: { text: string; original: string; onCancel: () => void }) {
  const paperRef = useRef<HTMLDivElement>(null)
  const followRef = useRef(true) // 自分で上へ読み返している間は、末尾へ引き戻さない

  useEffect(() => {
    const el = paperRef.current
    if (el && followRef.current) el.scrollTop = el.scrollHeight
  }, [text])

  // 最初の文字が届くまで
  if (!text) {
    return (
      <div className="dv-wait">
        <InkRings />
        <div role="status">
          <p className="dv-wait-title">あなたの言葉を、清書しています</p>
          <p className="dv-wait-sub">言い回しはそのまま、つなぎだけ整えます</p>
        </div>
        <button type="button" onClick={onCancel} className="btn btn-secondary">
          やめて入力に戻る
        </button>
      </div>
    )
  }

  return (
    <div className="dv-gen">
      <header className="dv-gen-head">
        <InkRings size="sm" />
        <h1 role="status">あなたの言葉を、清書しています</h1>
      </header>
      <div
        ref={paperRef}
        className="dv-paper"
        aria-busy="true"
        aria-label="清書の途中の本文"
        onScroll={(e) => {
          const el = e.currentTarget
          followRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48
        }}
      >
        <InkText text={text} original={original} />
      </div>
      {original.trim() && (
        <p className="dv-legend">
          <span>
            <span className="dv-legend-ink">墨</span>あなたの言葉
          </span>
          <span>
            <span className="dv-legend-gold">金の下線</span>AI が足した言葉
          </span>
        </p>
      )}
      <div className="dv-actions">
        <button type="button" onClick={onCancel} className="btn btn-secondary btn-block">
          やめて入力に戻る
        </button>
      </div>
    </div>
  )
}
