// 清書プロンプト（lib/draft-prompt.ts）の評価スクリプト。
// AI が「代筆者」ではなく「清書係」に徹しているか（本人の言葉を残し、書いていないことを足していないか）を、
// 決まった見本のメモで測る。プロンプトやモデルを変えたときに、前後の数字を比べて確かめるためのもの。
// 本番の /api/generate-draft と同じプロンプト・同じ生成パラメータ（DRAFT_GENERATION）で清書する（ストリーミングはしない）。
//
// 測るもの（AI を使わない比較。lib/draft-compose.ts の analyzeKept）:
//   本人の言葉 … 清書のうち本人の言葉が占める割合（own）。画面の「あなたの言葉 ◯%」と同じ数字。AI が文を足すと下がる
//   メモの残り … メモのうち清書に残った割合（kept）。メモが削られると下がる
//   長さの比   … 清書の文字数 ÷ メモの文字数（空白・記号を除く）。水増しすると大きくなる
// 本人の言葉が 85% 未満、または長さの比が 1.5 を超えた清書（と、空の出力・API の失敗）に印を付ける。
//
// 使い方:
//   npm run eval:draft                  全ケースを1回ずつ清書して採点する（GROQ_API_KEY が必要。.env.local があれば読む）
//   npm run eval:draft -- --runs 3      各ケースを3回ずつ清書する（同じメモでも出力がぶれるため）
//   npm run eval:draft -- --show        すべての清書を表示する（印が付いたものは常に表示。AI が足した言葉を［］で囲む）
//   npm run eval:draft -- --mock        API を呼ばず、原文をそのまま清書とみなす（キーなしで配線だけ確かめる）
//   npm run eval:draft -- --no-fail     印が付いても終了コードを 0 にする
// 印が付いた清書があれば終了コード 1（--no-fail のときを除く）。モデルは GROQ_MODEL_QUALITY で上書きできる。
import path from 'node:path'
import { analyzeKept, composeRaw } from '@/lib/draft-compose'
import { buildDraftUserPrompt, DRAFT_GENERATION, DRAFT_SYSTEM_PROMPT, type DraftPromptInput } from '@/lib/draft-prompt'

/** これを下回ったら印を付ける（清書のうち本人の言葉の割合） */
const OWN_MIN = 0.85
/** これを超えたら印を付ける（清書の文字数 ÷ メモの文字数） */
const RATIO_MAX = 1.5

interface EvalCase {
  name: string
  input: DraftPromptInput
  /** 過去日付の書き忘れ救済として書く場合の対象日（YYYY-MM-DD）。null なら今日の日記 */
  entryDate: string | null
}

const blank = { events: '', challenges: '', gratitude: '', freeform: '' }

// 見本のメモ（架空）。書き方の違い（キーワードだけ・箇条書き・話し言葉・です・ます調・長め・ふりかえりつき・過去の日付）を一通り含める
const CASES: EvalCase[] = [
  {
    name: 'キーワードだけ',
    input: { ...blank, mood: 2, energy: 2, events: '会議 疲れた 雨' },
    entryDate: null,
  },
  {
    name: 'ひと言だけ',
    input: { ...blank, mood: 4, energy: 4, gratitude: 'コーヒーおいしい' },
    entryDate: null,
  },
  {
    name: '箇条書き',
    input: { ...blank, mood: 4, energy: 4, events: '・朝ジム\n・資料づくり（午前中で終わらず）\n・夜はラーメン' },
    entryDate: null,
  },
  {
    name: '話し言葉',
    input: {
      ...blank,
      mood: 3,
      energy: 2,
      freeform: 'いやー今日まじで疲れた。上司の話長すぎでしょ。でも帰りに食べたアイスがうまかったからまあいっか',
    },
    entryDate: null,
  },
  {
    name: 'です・ます調',
    input: {
      ...blank,
      mood: 4,
      energy: 3,
      events: '午前中は図書館で勉強しました。午後は友人とカフェに行きました。',
      gratitude: '友人が話を聞いてくれて嬉しかったです。',
    },
    entryDate: null,
  },
  {
    name: '長め',
    input: {
      ...blank,
      mood: 3,
      energy: 3,
      events:
        '朝6時に起きて、久しぶりに川沿いを30分走った。仕事では新しいプロジェクトのキックオフがあって、自分が進行役をやった。' +
        '準備不足で段取りがもたついたけど、最後はなんとかまとまった。昼は同期とカレー。午後は資料の手直しでほぼ終わった。' +
        '帰りの電車で本を読もうとしたけど眠くて無理だった。',
      challenges: '進行役のとき、話が脱線したのを戻せなかった。次はアジェンダを先に共有しておく。',
      freeform: '週末は実家に帰る予定。母の誕生日プレゼントをまだ決めてない',
    },
    entryDate: null,
  },
  {
    name: '困ったこと＋感謝',
    input: {
      ...blank,
      mood: 2,
      energy: 2,
      challenges: '締め切りが3つ重なって焦ってる。どれから手をつけるか決められない',
      gratitude: '先輩が一つ引き取ってくれた。助かった',
    },
    entryDate: null,
  },
  {
    name: 'ふりかえりつき',
    input: {
      ...blank,
      mood: 2,
      energy: 3,
      events: '企画の会議で自分の案が通らなかった',
      reflectionQ: '一番引っかかったのは？',
      reflectionA: '前提を確認されなかったこと — 説明の順番を変えればよかった',
    },
    entryDate: null,
  },
  {
    name: '過去の日付',
    input: { ...blank, mood: 5, energy: 3, events: '友達の結婚式。スピーチ緊張した。泣いてる人が多かった' },
    entryDate: '2026-10-04',
  },
  {
    name: '誤字あり',
    input: { ...blank, mood: 2, energy: 3, events: 'ミーティングで資料のミスを指適された。確認不足だった' },
    entryDate: null,
  },
]

interface Options {
  runs: number
  mock: boolean
  show: boolean
  failOnFlag: boolean
}

const USAGE = '使い方: npm run eval:draft -- [--runs N] [--mock] [--show] [--no-fail]'

function exitWith(message: string): never {
  console.error(message)
  process.exit(1)
}

function parseArgs(argv: string[]): Options {
  const opts: Options = { runs: 1, mock: false, show: false, failOnFlag: true }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--mock') opts.mock = true
    else if (arg === '--show') opts.show = true
    else if (arg === '--no-fail') opts.failOnFlag = false
    else if (arg === '--runs' || arg.startsWith('--runs=')) {
      const value = arg === '--runs' ? argv[++i] : arg.slice('--runs='.length)
      const n = Number(value)
      if (!Number.isInteger(n) || n < 1 || n > 20) exitWith(`--runs には 1〜20 の整数を指定してください（${value ?? '未指定'}）`)
      opts.runs = n
    } else if (arg === '--help' || arg === '-h') {
      console.log(USAGE)
      process.exit(0)
    } else exitWith(`知らないオプションです: ${arg}\n${USAGE}`)
  }
  return opts
}

type Generate = (prompt: string, c: EvalCase) => Promise<string>

async function createGenerator(mock: boolean): Promise<{ model: string; generate: Generate }> {
  // 配線の確認用: 原文のまま（AI は使わない）。数字はすべて 100%・長さの比 1.00 になるはず
  if (mock) return { model: 'mock（原文のまま・API なし）', generate: async (_prompt, c) => composeRaw(c.input) }

  // .env.local を読んだあとで読み込む（GROQ_MODEL_QUALITY の上書きを、モデル名が決まる前に効かせるため）
  const { getGroqClient, GROQ_MODELS } = await import('@/lib/groq')
  const groq = getGroqClient()
  return {
    model: GROQ_MODELS.quality,
    generate: async (prompt) => {
      const completion = await groq.chat.completions.create({
        model: GROQ_MODELS.quality,
        ...DRAFT_GENERATION,
        messages: [
          { role: 'system', content: DRAFT_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
      })
      return completion.choices[0]?.message?.content?.trim() ?? ''
    },
  }
}

// 長さの比は、空白・句読点・記号を除いた文字数で比べる（句読点が足されただけで長くなったと扱わない）
const NON_TEXT = new RegExp('[\\s\\p{P}\\p{S}]', 'gu')
const textLength = (s: string) => Array.from(s.replace(NON_TEXT, '')).length

interface Row {
  name: string
  run: number
  memo: string
  draft: string
  /** AI が足した言葉を［］で囲んだ清書（つなぎの助詞は囲まない） */
  marked: string
  memoChars: number
  draftChars: number
  own: number
  kept: number
  ratio: number
  seconds: number | null
  flags: string[]
}

async function evaluate(c: EvalCase, run: number, generate: Generate, mock: boolean): Promise<Row> {
  const memo = composeRaw(c.input)
  const prompt = buildDraftUserPrompt(c.input, c.entryDate)
  const started = Date.now()
  const base = { name: c.name, run, memo, memoChars: textLength(memo) }

  let draft: string
  try {
    draft = await generate(prompt, c)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ...base, draft: '', marked: `（失敗: ${message}）`, draftChars: 0, own: 0, kept: 0, ratio: 0, seconds: null, flags: ['エラー'] }
  }
  const seconds = mock ? null : (Date.now() - started) / 1000

  const a = analyzeKept(memo, draft)
  const draftChars = textLength(draft)
  const ratio = base.memoChars ? draftChars / base.memoChars : 0
  const flags: string[] = []
  if (!draft) flags.push('空の出力')
  else {
    if (a.own < OWN_MIN) flags.push(`本人の言葉<${pct(OWN_MIN)}`)
    if (ratio > RATIO_MAX) flags.push(`長さ>${RATIO_MAX}倍`)
  }
  const marked = a.segments.map((s) => (s.added && !s.connector ? `［${s.text}］` : s.text)).join('')
  return { ...base, draft, marked, draftChars, own: a.own, kept: a.kept, ratio, seconds, flags }
}

const pct = (v: number) => `${Math.round(v * 1000) / 10}%`
/** 2行目以降を「メモ: 」「清書: 」の幅だけ下げる（空行には空白を付けない） */
const indent = (s: string) => s.replace(/\n(?=.)/g, '\n      ')
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

/** 端末での表示幅（全角は2文字分） */
function widthOf(s: string): number {
  let w = 0
  for (const c of s) w += /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/.test(c) ? 2 : 1
  return w
}

function printTable(header: string[], rows: string[][], alignRight: boolean[]) {
  const widths = header.map((h, i) => Math.max(widthOf(h), ...rows.map((r) => widthOf(r[i]))))
  const line = (cells: string[]) =>
    cells
      .map((cell, i) => {
        const pad = ' '.repeat(widths[i] - widthOf(cell))
        return alignRight[i] ? pad + cell : cell + pad
      })
      .join('  ')
      .trimEnd()
  console.log(line(header))
  console.log(widths.map((w) => '-'.repeat(w)).join('  '))
  rows.forEach((r) => console.log(line(r)))
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))

  // process.loadEnvFile は Node 20.12 以上。古い Node で黙って読み飛ばすと「キーが無い」と誤解させるので明示する
  if (typeof process.loadEnvFile !== 'function') {
    exitWith(`この評価スクリプトには Node.js 20.12 以上が必要です（いまは ${process.version}）。`)
  }
  try {
    process.loadEnvFile(path.join(process.cwd(), '.env.local'))
  } catch (err) {
    // .env.local が無ければ、すでに設定されている環境変数だけで動かす（それ以外の読み込みエラーは伝える）
    if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      exitWith(`.env.local を読み込めませんでした: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  if (!opts.mock && !process.env.GROQ_API_KEY) {
    exitWith(
      'GROQ_API_KEY が設定されていません。.env.local に GROQ_API_KEY を書くか、環境変数で渡してください。\n' +
        'API を使わずに配線だけ確かめるなら: npm run eval:draft -- --mock'
    )
  }

  const { model, generate } = await createGenerator(opts.mock)
  console.log('清書プロンプトの評価')
  console.log(
    `モデル: ${model} / temperature: ${DRAFT_GENERATION.temperature} / reasoning_effort: ${DRAFT_GENERATION.reasoning_effort}` +
      ` / ケース: ${CASES.length} × ${opts.runs}回`
  )
  console.log(`印の基準: 本人の言葉 < ${pct(OWN_MIN)} または 長さの比 > ${RATIO_MAX}（ほかに空の出力・API の失敗）`)
  console.log('')

  // 1件ずつ順に呼ぶ（並べて呼ぶと API の流量制限に当たりやすい）
  const rows: Row[] = []
  const total = CASES.length * opts.runs
  for (const c of CASES) {
    for (let run = 1; run <= opts.runs; run++) {
      if (process.stderr.isTTY) process.stderr.write(`\r清書中… ${rows.length + 1}/${total}`)
      rows.push(await evaluate(c, run, generate, opts.mock))
    }
  }
  if (process.stderr.isTTY) process.stderr.write('\r\x1b[K')

  printTable(
    ['ケース', '回', '本人の言葉', 'メモの残り', '長さの比', 'メモ→清書', '秒', '判定'],
    rows.map((r) => {
      const failed = r.flags.includes('エラー') // 清書が無いので数字は出さない
      return [
        r.name,
        String(r.run),
        failed ? '-' : pct(r.own),
        failed ? '-' : pct(r.kept),
        failed ? '-' : r.ratio.toFixed(2),
        failed ? `${r.memoChars}→-` : `${r.memoChars}→${r.draftChars}`,
        r.seconds == null ? '-' : r.seconds.toFixed(1),
        r.flags.length ? `要確認（${r.flags.join('・')}）` : 'OK',
      ]
    }),
    [false, true, true, true, true, true, true, false]
  )

  // 平均は、清書が返ってきたものだけで出す（失敗は数に入れない）
  const ok = rows.filter((r) => !r.flags.includes('エラー'))
  console.log('')
  console.log(
    `平均（${ok.length}件）: 本人の言葉 ${pct(mean(ok.map((r) => r.own)))} / メモの残り ${pct(mean(ok.map((r) => r.kept)))}` +
      ` / 長さの比 ${mean(ok.map((r) => r.ratio)).toFixed(2)}`
  )
  const flagged = rows.filter((r) => r.flags.length)
  console.log(`要確認: ${flagged.length} / ${rows.length} 件`)

  const details = opts.show ? rows : flagged
  if (details.length) {
    console.log('')
    console.log('— 清書（AI が足した言葉を［］で囲む） —')
    for (const r of details) {
      console.log('')
      console.log(`■ ${r.name} #${r.run}${r.flags.length ? `  要確認（${r.flags.join('・')}）` : ''}`)
      console.log(`メモ: ${indent(r.memo)}`)
      console.log(`清書: ${indent(r.marked)}`)
    }
  }

  if (flagged.length && opts.failOnFlag) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
