// 気分の定数
export const MOODS = [
  { value: 1, emoji: '😞', label: 'とても悪い', color: '#b5654a' },
  { value: 2, emoji: '😕', label: '悪い', color: '#c5895f' },
  { value: 3, emoji: '😐', label: '普通', color: '#cdbf9a' },
  { value: 4, emoji: '🙂', label: '良い', color: '#9caa7e' },
  { value: 5, emoji: '😄', label: 'とても良い', color: '#6f8a5f' },
] as const

// エネルギーの定数
export const ENERGY = [
  { value: 1, label: '枯渇', description: '何もできない', color: '#b5654a' },
  { value: 2, label: '低い', description: '最小限のみ', color: '#c5895f' },
  { value: 3, label: '普通', description: '日常通り', color: '#cdbf9a' },
  { value: 4, label: '高い', description: '活発に動ける', color: '#9caa7e' },
  { value: 5, label: '最高', description: '何でもできる', color: '#6f8a5f' },
] as const

// チェックインのステップ定数
export const STEPS = [
  { id: 'mood', title: '今日の気分は？', description: '直感で選んでください' },
  { id: 'energy', title: 'エネルギーレベルは？', description: '今の体の状態を教えてください' },
  { id: 'events', title: '今日あったことは？', description: '出来事・行動・会話など' },
  { id: 'challenges', title: '困ったことや課題は？', description: '問題・悩み・不安など（任意）' },
  { id: 'gratitude', title: '感謝できることは？', description: '小さなことでも大丈夫' },
  { id: 'freeform', title: '自由記述', description: '何でも書いてください（任意）' },
] as const

export type StepId = typeof STEPS[number]['id']

// 毎日ローテーションするサブテキスト (曜日 or 日付ベース)
const STEP_DESCRIPTIONS: Record<string, string[]> = {
  mood: [
    '直感で選んでください',
    '今この瞬間の気持ちは？',
    '正直に選んでみて',
    '体の感覚に耳を傾けて',
    '朝・昼・夜のどれで考えてもOK',
    '自分に正直になって',
    '今の気持ちをひと言で',
  ],
  energy: [
    '今の体の状態を教えてください',
    '充電具合はどのくらい？',
    '体はどんな感じですか？',
    '疲れ具合を正直に',
    'みなぎってる？それとも疲れ気味？',
    '体と相談してみて',
    '今日動ける感じがする？',
  ],
  events: [
    '出来事・行動・会話など',
    '印象に残ったことは？',
    '今日どこへ行って何をした？',
    '誰かと話したこと、したことは？',
    '今日の「ハイライト」は？',
    '何があった？何をした？',
    '気になったこと、気づいたことは？',
  ],
  challenges: [
    '問題・悩み・不安など（任意）',
    'もやもやしたことはある？',
    '改善したいことはある？',
    '難しかったことは？',
    '心にひっかかっていることは？',
    'うまくいかなかったことは？',
    'しんどかったことは？',
  ],
  gratitude: [
    '小さなことでも大丈夫',
    '今日の「良かったこと」は？',
    '感謝したいことを1つ',
    'うれしかった瞬間は？',
    '今日あってよかったことは？',
    '誰かに感謝したいことは？',
    '自分を褒めてあげることは？',
  ],
  freeform: [
    '何でも書いてください（任意）',
    '言いたいこと、何でも',
    '今日の自分へのメッセージ',
    '誰にも言えないことでもOK',
    'ひとり言でも日記でも',
    '明日の自分へ',
    'ゆっくり書いてみて',
  ],
}

/** JST の日付から今日のステップ説明文を返す（7日ローテーション） */
export function getDailyDescription(stepId: string): string {
  const descs = STEP_DESCRIPTIONS[stepId]
  if (!descs?.length) return ''
  const jstDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
  const [, m, d] = jstDate.split('-').map(Number)
  const dayOfYear = Math.floor(new Date(2024, m - 1, d).getTime() / 86400000)
  return descs[((dayOfYear % descs.length) + descs.length) % descs.length]
}

// ローカルストレージのキー
export const STORAGE_KEYS = {
  CHECKIN_DRAFT: 'inner-mirror-checkin-draft',
  SETTINGS: 'inner-mirror-settings',
  INSIGHTS_CACHE: 'insights-analysis-cache',
  WEEKLY_REPORT_CACHE: 'insights-weekly-report-cache',
  MILESTONE_PREFIX: 'inner-mirror-milestone-',
} as const

/**
 * サインアウト時にユーザー固有のローカルデータを削除する（共有端末対策）。
 * テーマ・PWAバナーの非表示フラグは端末の設定なので残す。
 */
export function clearUserLocalData() {
  try {
    localStorage.removeItem(STORAGE_KEYS.CHECKIN_DRAFT)
    localStorage.removeItem(STORAGE_KEYS.SETTINGS)
    localStorage.removeItem(STORAGE_KEYS.INSIGHTS_CACHE)
    localStorage.removeItem(STORAGE_KEYS.WEEKLY_REPORT_CACHE)
    Object.keys(localStorage)
      .filter((key) => key.startsWith(STORAGE_KEYS.MILESTONE_PREFIX))
      .forEach((key) => localStorage.removeItem(key))
  } catch {
    // localStorage が使えない環境では何もしない
  }
}
