// オフライン時・API失敗時のフォールバック日記生成
import type { CheckinInput } from '@/stores/checkin'
import { MOODS, ENERGY } from '@/lib/constants'

export interface DraftResult {
  draft: string
  tags: string[]
  summary: string
  dominantEmotion: string
}

// テンプレートベースで日記ドラフトを生成（AI不使用）
export function generateOfflineDraft(input: CheckinInput): DraftResult {
  const moodInfo = MOODS.find((m) => m.value === input.mood)
  const energyInfo = ENERGY.find((e) => e.value === input.energy)

  const today = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })

  const parts: string[] = []

  // 日付と気分・エネルギー
  parts.push(`${today}の記録`)
  parts.push('')

  if (moodInfo && energyInfo) {
    parts.push(
      `今日の気分は${moodInfo.label}（${moodInfo.emoji}）、エネルギーは${energyInfo.label}でした。`
    )
  }

  // 出来事
  if (input.events?.trim()) {
    parts.push('')
    parts.push('【今日の出来事】')
    parts.push(input.events.trim())
  }

  // 課題・困ったこと
  if (input.challenges?.trim()) {
    parts.push('')
    parts.push('【課題・困ったこと】')
    parts.push(input.challenges.trim())
  }

  // 感謝
  if (input.gratitude?.trim()) {
    parts.push('')
    parts.push('【感謝できること】')
    parts.push(input.gratitude.trim())
  }

  // 自由記述
  if (input.freeform?.trim()) {
    parts.push('')
    parts.push('【メモ】')
    parts.push(input.freeform.trim())
  }

  const draft = parts.join('\n')

  // タグを自動生成
  const tags: string[] = []
  if (moodInfo) tags.push(moodInfo.label)
  if (energyInfo) tags.push(`エネルギー:${energyInfo.label}`)
  if (input.challenges?.trim()) tags.push('課題あり')
  if (input.gratitude?.trim()) tags.push('感謝')

  // サマリー
  const moodText = moodInfo ? `気分${moodInfo.label}` : ''
  const energyText = energyInfo ? `エネルギー${energyInfo.label}` : ''
  const summary = [moodText, energyText].filter(Boolean).join('・')

  // 主要感情
  const dominantEmotion = getDominantEmotion(input.mood ?? 3)

  return { draft, tags, summary, dominantEmotion }
}

function getDominantEmotion(mood: number): string {
  const emotions: Record<number, string> = {
    1: '落ち込み',
    2: '不安',
    3: '平静',
    4: '満足',
    5: '喜び',
  }
  return emotions[mood] ?? '平静'
}
