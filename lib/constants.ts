import { todayJST } from '@/lib/jst'

// 気分の定数。
// emoji は通知の文面・Notion のページアイコンなど「文字だけの場所」で使う（アプリの画面では月の満ち欠けの図形 MoodGlyph を使う）。
// color は CSS 変数（app/globals.css の --mood-1〜5）。色を変えるときは globals.css だけを直す
export const MOODS = [
  { value: 1, emoji: '😞', label: 'とても悪い', color: 'var(--mood-1)' },
  { value: 2, emoji: '😕', label: '悪い', color: 'var(--mood-2)' },
  { value: 3, emoji: '😐', label: '普通', color: 'var(--mood-3)' },
  { value: 4, emoji: '🙂', label: '良い', color: 'var(--mood-4)' },
  { value: 5, emoji: '😄', label: 'とても良い', color: 'var(--mood-5)' },
] as const

// エネルギーの定数（画面では器の水位の図形 EnergyGlyph で表す）
export const ENERGY = [
  { value: 1, label: '枯渇', description: '何もできない' },
  { value: 2, label: '低い', description: '最小限のみ' },
  { value: 3, label: '普通', description: '日常通り' },
  { value: 4, label: '高い', description: '活発に動ける' },
  { value: 5, label: '最高', description: '何でもできる' },
] as const

// チェックインのステップ定数（2画面: 調子 → メモ。タップ数を最小にする）
export const STEPS = [
  { id: 'state', title: '今日の調子は？', description: '気分とエネルギーをタップ' },
  { id: 'notes', title: '今日のことを少しだけ', description: '書けるところだけでOK（すべて任意）' },
] as const

// 毎日ローテーションするサブテキスト (曜日 or 日付ベース)。チェックインの2画面（STEPS の id）ぶん
const STEP_DESCRIPTIONS: Record<string, string[]> = {
  state: [
    '気分とエネルギーをタップ',
    '直感で選んでください',
    '今この瞬間の気持ちと充電具合は？',
    '体の感覚に耳を傾けて',
    '正直に選んでみて',
    '自分に正直になって',
    '今日の自分をひと目で',
  ],
  notes: [
    '書けるところだけでOK（すべて任意）',
    '印象に残ったことをひと言だけでも',
    'キーワードだけでも日記になります',
    '話して入力することもできます',
    '今日の「ハイライト」は？',
    '全部スキップしてもOK',
    'ゆっくりでいいので、思い出してみて',
  ],
}

/**
 * その日（YYYY-MM-DD, JST）のステップ説明文を返す（7日ローテーション）。
 * 日数は UTC の暦で数えるので、端末とサーバーのタイムゾーンが違っても同じ文になる。
 * ただし /checkin はビルド時に静的生成されるため、画面ではマウント後に呼ぶこと（描画の食い違いを防ぐ）。
 */
export function getDailyDescription(stepId: string, date: string = todayJST()): string {
  const descs = STEP_DESCRIPTIONS[stepId]
  if (!descs?.length) return ''
  // 実際の年で数える（固定の年で数えると、年末年始や平年の2月末で同じ文が続いてしまう）
  const [y, m, d] = date.split('-').map(Number)
  const dayNumber = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
  return descs[((dayNumber % descs.length) + descs.length) % descs.length]
}

/** 気分の値（1〜5）の絵文字・ラベル。範囲外なら undefined（呼び出し側で既定を決める） */
export const moodEmoji = (value: number | null | undefined) => MOODS.find((m) => m.value === value)?.emoji
export const moodLabel = (value: number | null | undefined) => MOODS.find((m) => m.value === value)?.label
/** 気分の色（CSS 変数）。範囲外・未入力なら「普通」の色 */
export const moodColor = (value: number | null | undefined) => MOODS.find((m) => m.value === value)?.color ?? 'var(--mood-3)'
export const energyLabel = (value: number | null | undefined) => ENERGY.find((e) => e.value === value)?.label
/** エネルギーの値（1〜5）の説明（例:「活発に動ける」）。範囲外なら undefined */
export const energyDescription = (value: number | null | undefined) => ENERGY.find((e) => e.value === value)?.description

// ローカルストレージのキー
export const STORAGE_KEYS = {
  CHECKIN_DRAFT: 'inner-mirror-checkin-draft',
  SETTINGS: 'inner-mirror-settings',
  INSIGHTS_CACHE: 'insights-analysis-cache',
  WEEKLY_REPORT_CACHE: 'insights-weekly-report-cache',
  MILESTONE_PREFIX: 'inner-mirror-milestone-',
  MEMOS: 'inner-mirror-memos',
  FOCUS: 'inner-mirror-focus',
} as const

/** 端末の設定のキー（サインアウトしても残す）。layout.tsx のちらつき防止スクリプトも同じキーを読む */
export const DEVICE_KEYS = {
  THEME: 'inner-mirror-theme',
  PWA_BANNER_DISMISSED: 'pwa-banner-dismissed',
} as const

/** アカウントごとに分けて保存するキー（例: AI 分析のキャッシュ）。サインアウトでは base の付いたものをまとめて消す */
export function userScopedKey(base: string, userId: string): string {
  return `${base}:${encodeURIComponent(userId)}`
}
const isUserScopedKey = (key: string, base: string) => key.startsWith(`${base}:`)

/**
 * サインアウト時にユーザー固有のローカルデータを削除する（共有端末対策）。
 * テーマ・PWAバナーの非表示フラグ（DEVICE_KEYS）は端末の設定なので残す。
 */
export function clearUserLocalData() {
  try {
    localStorage.removeItem(STORAGE_KEYS.CHECKIN_DRAFT)
    localStorage.removeItem(STORAGE_KEYS.SETTINGS)
    localStorage.removeItem(STORAGE_KEYS.INSIGHTS_CACHE)
    localStorage.removeItem(STORAGE_KEYS.WEEKLY_REPORT_CACHE)
    localStorage.removeItem(STORAGE_KEYS.MEMOS)
    localStorage.removeItem(STORAGE_KEYS.FOCUS)
    Object.keys(localStorage)
      .filter((key) =>
        key.startsWith(STORAGE_KEYS.MILESTONE_PREFIX) ||
        isUserScopedKey(key, STORAGE_KEYS.INSIGHTS_CACHE) ||
        isUserScopedKey(key, STORAGE_KEYS.WEEKLY_REPORT_CACHE)
      )
      .forEach((key) => localStorage.removeItem(key))
  } catch {
    // localStorage が使えない環境では何もしない
  }
}
