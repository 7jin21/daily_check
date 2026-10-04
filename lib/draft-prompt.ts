import type { CheckinInput } from '@/stores/checkin'
import { MOODS, ENERGY } from '@/lib/constants'

// 日記生成プロンプト（/api/generate-draft）。
// 方針: AI は「代筆者」ではなく「清書係」。本人が書いた言葉・言い回し・語尾をそのまま残し、
// つなぎ・誤字の修正・並べ替えだけを行う。書かれていない出来事・感情・気づきは足さない。
// （以前は「500文字程度・気持ちや内省を添えてよい」だったため、短い入力ほど AI の文章に置き換わっていた）

export interface DraftPromptInput extends CheckinInput {
  reflectionQ?: string
  reflectionA?: string
}

export const DRAFT_SYSTEM_PROMPT = `あなたは、本人が書いたメモを日記帳に清書する係です。
文章を「書く」のではなく、本人の言葉を「整える」ことだけが仕事です。

必ず守るルール:
- 本人が書いた文・言い回し・語尾・時制・口調は、そのまま使う。別の言葉に言い換えない。きれいな表現に直さない
  （例:「嬉しい」を「嬉しかった」に、「溜まってる」を「溜まっている」に変えない）
- 手を加えてよいのは次の3つだけ:
  1. 単語や箇条書きを、本人の語を使って文につなぐための最小限の助詞・接続語
  2. 明らかな誤字脱字の修正
  3. 読みやすくするための順番の入れ替え・段落分け
- 本人が書いていない出来事・感情・気づき・教訓・まとめの一文は絶対に足さない（「〜を大切にしたい」「明日も頑張ろう」などの締めも書かない）
- メモの欄の名前（今日あったこと・困ったこと・感謝 など）を、見出しや「困ったことは〜」「感謝したいのは〜」のような前置きとして書かない。本人の文をそのまま並べる
- 長さは本人の入力とほぼ同じにする。短い入力なら短い日記でよい。水増ししない
- 口調は本人の入力に合わせる（だ・である調／です・ます調／話し言葉）。本人の文体が最優先
- 一人称は本人の入力にあればそれに合わせ、なければ省略してよい

その他:
- 気分・エネルギーは、本文から気分が読み取れない場合に限り、ごく短く一言だけ触れてよい（数字やスコアは書かない）
- 「ふりかえり」の答えは本人の言葉のまま使う。答えが名詞句なら、問いの言葉を借りて最小限の一文にする
  （例: 問い「一番引っかかったのは？」答え「前提を確認されなかったこと」→「一番引っかかったのは、前提を確認されなかったこと。」）
- 「—」「→」などの区切り記号は文章に残さず、句読点でつなぐ
- 日記の本文のみを出力する（前置き・見出し・記号・JSONは一切付けない）`

/** 入力テキストの総文字数（長さの目安をモデルに伝えるため） */
export function countInputChars(input: DraftPromptInput): number {
  return [input.events, input.challenges, input.gratitude, input.freeform, input.reflectionA]
    .map((s) => (typeof s === 'string' ? s.trim().length : 0))
    .reduce((a, b) => a + b, 0)
}

export function buildDraftUserPrompt(input: DraftPromptInput, entryDate: string | null): string {
  const parts: string[] = []

  // 過去日付の書き忘れ救済: その日の日記として書く（「今日」と書かないよう明示）
  if (entryDate) {
    const label = new Date(`${entryDate}T12:00:00+09:00`).toLocaleDateString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    })
    parts.push(`この日記の対象日: ${label}（あとから振り返って書いている）`)
  }

  const moodLabel = MOODS.find((m) => m.value === input.mood)?.label
  const energyLabel = ENERGY.find((e) => e.value === input.energy)?.label
  parts.push(`気分: ${input.mood}/5（${moodLabel ?? '-'}）`)
  parts.push(`エネルギー: ${input.energy}/5（${energyLabel ?? '-'}）`)

  if (input.events?.trim()) parts.push(`【本人のメモ: 今日あったこと】\n${input.events.trim()}`)
  if (input.challenges?.trim()) parts.push(`【本人のメモ: 困ったこと】\n${input.challenges.trim()}`)
  if (input.gratitude?.trim()) parts.push(`【本人のメモ: 感謝・良かったこと】\n${input.gratitude.trim()}`)
  if (input.freeform?.trim()) parts.push(`【本人のメモ: 自由メモ】\n${input.freeform.trim()}`)

  const q = input.reflectionQ?.trim()
  const a = input.reflectionA?.trim()
  if (q && a) {
    parts.push(`【ふりかえり】\n問い: ${q.slice(0, 300)}\n本人の答え: ${a.slice(0, 300)}\n（問いやラベルは書かず、答えの言葉だけを使う）`)
  }

  const chars = countInputChars(input)
  parts.push(
    chars === 0
      ? '本人のメモはありません。気分とエネルギーの様子を、数字を使わず1文だけ短く書いてください（例:「気分は良く、体力はふつうの一日だった。」）。出来事は創作しないこと。'
      : `本人のメモは合計約${chars}文字です。清書後もおおむね${Math.max(40, Math.round(chars * 1.3))}文字以内に収めてください。`
  )

  return parts.join('\n\n')
}
