# Inner Mirror 🪞

iPhone のホーム画面から使える AI 日記アプリ（PWA）。気分とエネルギーをタップして思ったことを少し書くと、AI があなたの言葉を言い換えずに読みやすく清書します（AI は代わりに書く「代筆者」ではなく、整えるだけの「清書係」）。記録は Supabase に保存され、Notion にも自動同期できます。

---

## できること

- **30 秒チェックイン** — 気分・エネルギーを選ぶだけで記録完了（**2 画面構成**。テキスト・音声入力に対応）。疲れた日は**「気分だけで記録する」**で AI を通さず保存でき、言葉はあとから日記に書き足せる（タグ・要約も、AI が使えればそのとき補完）。同じ日にもう一度チェックインすると、前の日記を消さずに**追記**される
- **書き忘れ救済** — 昨日〜7 日前までの記録をあとから書ける（`/checkin?date=YYYY-MM-DD`。ホームに昨日が空きの場合の導線あり）
- **毎日のリマインダー（Web Push）** — 記録がまだの日だけ、夜にプッシュ通知。昨日の気分を文面に差し込む（[設定方法](#プッシュ通知リマインダーの設定)）
- **今日のひとこと** — 日中に思ったことをホームから時刻つきでメモ（音声も可）。夜のチェックインで、残したいものを選んで「今日あったこと」に入れる（この端末に保存・日付が変わると持ち越さない）
- **カレンダーから選んで挿入** — 当日の Google Calendar 予定のうち、日記に残したいものだけを選んで挿入
- **音声入力** — テキスト欄を 🎤 で音声入力 → GROQ Whisper が文字起こし。iPhone のホーム画面 PWA でも安定動作（[詳細](#音声入力音声で日記を書く)）
- **AI 清書** — 書いたメモを、**あなたの言葉・言い回し・口調のまま**読みやすい日記に整える（GROQ / gpt-oss-120b）。言い換え・水増し・書いていない感情や教訓の追加はしない。長さは入力とほぼ同じ。文章はリアルタイムにストリーミング表示され、タグ・感情も自動抽出。整え方は **原文のまま／整える（AI）／箇条書き** から選べ、**元のメモと並べて「AI が足した言葉」に下線**を引き、日記の本文のうちあなたの言葉が占める割合を表示。書き直しは「元に戻す」で戻せる。AI らしい文章にしたいときは「感情豊かに」などで任意に書き直せます（[詳細](#ai-清書本人の言葉を残す)）
- **AI 内省ガイド** — 日記生成の前に、AI が「足りていない1点」（例: なぜそう感じた？／何を大事にしていた？）を **1問だけ** 3〜4択で提示（問いはメモを書いている間に裏で用意しておくので、たいてい待たずに出る）。タップで選ぶだけで感情の理由・価値観が日記に織り込まれます（スキップ可・[詳細](#ai-内省ガイド入力を深掘りする1問)）
- **AI 書き直し** — 「感情豊かに」「短くして」などワンタップで文体変更
- **Notion 自動同期** — 保存と同時に Notion データベースへ書き出し（同期済みのページは、本文をアプリの日記で置き換える。[詳細](#notion-連携任意)）
- **インサイト分析** — 過去の記録から傾向・パーソナリティ・感情トリガー・**価値観（内省ガイドの回答を素材に）**を AI 分析。感情トリガーには**根拠になった日付とその日の本人の言葉**を添え、日記を開ける。曜日×気分・タグ×気分のローカル統計も表示（タグからその記録の一覧へ）。「過去30日の記録ペース」には記録した日数に加えて**「うち言葉つき N日」**（気分だけでなく言葉も残した日）を表示。あとで読み返せる自分の言葉がどれだけ残っているかは、こちらの数字で見るのがおすすめ
- **AI に聞いてみる** — 「最近気分がいい日の共通点は？」など、日記データに基づいて AI が 1 問 1 答
- **週次レポート** — 直近 7 日間の振り返りナラティブを生成。「来週のフォーカス」は**採用・言い換え**ができ、ホームに表示して「今日やった」をワンタップで記録。次のレポートでその実施日数をふまえてふり返る（採用したフォーカスはこの端末に保存）
- **フラッシュバック** — 1 年前・1 ヶ月前の今日の記録をホームに表示。当時の本文はそのままに**「今の一言」を添えられる**
- **気分の波をたどる** — ホームのグラフの点をタップ（横になぞる）と、その日の気分・エネルギーが出て日記を開ける
- **検索・ページング** — 日記一覧でキーワード検索（本文・出来事・メモ）。タグで絞り込むと、同じテーマの記録を時系列でたどれる（`/entries?tag=仕事`）
- **データ所有権** — JSON / CSV エクスポート、日記の個別削除
- **AI が使えなくても書ける** — AI API が未設定・接続に失敗したときは、書いたメモをそのまま日記の本文にする（メモが空ならテンプレートで作る）。電波の無い状態で使えるという意味のオフライン対応ではありません

---

## クイックスタート

必須なのは **Supabase** と **GROQ API キー**（無料枠あり）の 2 つだけです。

```bash
npm install
cp .env.local.example .env.local   # Windows: Copy-Item .env.local.example .env.local
# .env.local に Supabase の URL / ANON_KEY と GROQ_API_KEY を入力
npm run dev
```

→ `http://localhost:3000` を開いてログインできれば完了。

詳細は [セットアップ手順](#セットアップ手順) へ。

---

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フレームワーク | Next.js 15 (App Router) |
| ホスティング | Vercel |
| 認証・DB | Supabase Auth + PostgreSQL（RLS でユーザーごとにデータ分離） |
| AI | GROQ API（gpt-oss-120b / gpt-oss-20b、日本語で選定。音声文字起こしは Whisper） |
| 外部同期 | Notion API / Google Calendar API |
| 状態管理 | Zustand |
| スタイリング | Tailwind CSS ＋ CSS 変数（和紙と墨の基調 / トークン一元管理）。ホームは `components/home/home.css` |
| フォント | Cormorant Garamond（欧文・数字）＋ Shippori Mincho（和文明朝）＋ Zen Kaku Gothic New（小さな UI 文字） |
| PWA | Web App Manifest + Service Worker |

---

## アーキテクチャ

```
iPhone Safari（PWA）
       │ HTTPS
       ▼
 Next.js 15 on Vercel
 ┌─────────────────────────────────────┐
 │  App Router（React）                 │  ← 画面
 │  ┌──────────────────────────────┐   │
 │  │  API Routes（BFF）           │   │  ← サーバー処理
 │  │  POST /api/checkin-question  │───┼──→  GROQ API（生成前の内省質問・JSON）
 │  │  POST /api/generate-draft    │───┼──→  GROQ API（日記生成・ストリーミング）
 │  │  POST /api/draft-meta        │───┼──→  GROQ API（タグ・サマリー抽出）
 │  │  POST /api/rewrite-draft     │───┼──→  GROQ API（書き直し）
 │  │  POST /api/analyze           │───┼──→  GROQ API（パーソナリティ分析）
 │  │  POST /api/weekly-report     │───┼──→  GROQ API（週次レポート）
 │  │  POST /api/ask               │───┼──→  GROQ API（日記へのQ&A）
 │  │  POST /api/transcribe        │───┼──→  GROQ API（音声文字起こし / Whisper）
 │  │  POST /api/notion-sync       │───┼──→  Notion API
 │  │  GET  /api/calendar/today    │───┼──→  Google Calendar API
 │  │  GET/POST /api/settings      │   │  ← 設定の読み書き（トークン暗号化）
 │  │  GET  /api/export            │   │  ← JSON / CSV エクスポート
 │  │  POST/DELETE /api/push/...   │   │  ← Web Push 購読の登録・解除
 │  │  GET  /api/cron/reminder     │◀──┼───  Vercel Cron（リマインダー配信）
 │  └──────────────────────────────┘   │
 └──────────────────┬──────────────────┘
                    ▼
              Supabase（Auth + PostgreSQL）
```

**BFF パターンを使う理由**: AI の API キーをブラウザから直接使うとキーが盗まれます。すべての外部 API 呼び出しを Next.js のサーバーサイド（API Routes）経由にし、キーは Vercel の環境変数にのみ保持します。

```
❌ ブラウザ → GROQ API（API キーが露出）
✅ ブラウザ → /api/generate-draft（Next.js サーバー） → GROQ API
```

---

## チェックインフロー

**2 画面**で 30 秒〜1 分。**必須は気分とエネルギーのみ**で、テキストは全てスキップ可能。

| # | 内容 | 必須 |
|---|------|:----:|
| 1 | 気分（5 段階絵文字）＋ エネルギー（5 段階バー） | ✅ |
| 2 | 今日あったこと（テキスト / 音声 / 📅 カレンダー予定の挿入）＋ 困ったこと・感謝・自由メモ（折りたたみ） | — |

- 入力内容は localStorage に自動保存されるため、途中でアプリを閉じても続きから再開できます（ホームの CTA が「続きから再開」に変わります）
- **過去日付の記録**: `/checkin?date=YYYY-MM-DD`（7 日前まで）。ホームに「昨日の記録がありません」導線が出ます。連続記録（ストリーク）も埋めれば復活します
- **同じ日にもう一度チェックインしたとき**: その日にすでに言葉のある日記があれば、保存は**上書きではなく追記**になります（下書き画面で保存の前にお知らせが出て、ボタンも「追記して保存する」に変わります）。気分だけの記録しかない日は、追記ではなくそのまま書き込みます
  - 前の日記の本文・メモ・ふりかえり・「あとから」の一言は**保存されているまま**残し（組み直さない）、今回の分をそのあとに足すだけです。足さないのは同じ内容の保存のやり直し（通信の失敗で同じものをもう一度保存したときなど）だけで、前の文の一部と同じ短い言葉（朝「会議で疲れた」・夜「疲れた」）は別のときの言葉として足します
  - 要約・タグ・感情は、**AI が作れた項目だけ**追記後の本文全体から作り直します。AI が使えない・失敗したときは前の要約・タグ・感情を残します（タグは今回の分を足すだけで、空で上書きして消すことはありません）。本文がとても長い日は、始まりと終わりを合わせた 3000 文字（`/api/draft-meta` が受け取れる上限）から作ります
  - 気分・エネルギーは今回選んだ値になります
  - 保存に失敗したときは、その日に言葉のある日記があるかを確かめ直して、お知らせを出し直します（保存は届いていて応答だけ失われた場合、次の保存は追記になるため）

---

## データフロー

```
1. チェックイン入力
   └── Zustand store + localStorage に保存

2. 「日記に清書する ✨」（チェックイン 2 画面目のボタン。何も書いていなければ「気分だけで記録する」になる）
   └── （入力中から先読みしておいた）POST /api/checkin-question → 足りない1点を1問だけ提示（skip 可）
   └── 回答があれば生成の文脈に追加し、保存時に freeform へ畳む
   └── POST /api/generate-draft → GROQ API
   └── { draft, tags, summary, dominantEmotion } を受け取り編集画面へ
   └── API 未設定・失敗時 → 「AI に接続できませんでした」と出し、書いたメモをそのまま本文にする（メモが空ならテンプレート）

3. 「保存する 💾」（追記になる日は「追記して保存する 💾」）
   └── その日にすでに言葉のある日記があれば、保存の前に「追記になる」ことを表示
   └── Supabase の diary_entries へ upsert（1 ユーザー 1 日 1 件）
         ├── 新規・気分だけの記録 → そのまま書き込む
         └── 言葉のある日記がある → 上書きせず追記
               ├── 前の本文・メモ・ふりかえり・あとからの一言は保存されたまま残し、そのあとに足す
               │   （足さないのは同じ内容の保存のやり直しだけ）
               └── POST /api/draft-meta（本文全体。長い日は始まりと終わりの 3000 文字）
                     → AI が作れた要約・タグ・感情だけ書き換える（作れなければ前の値のまま）
   └── 保存に失敗したら、追記になるかを確かめ直してお知らせを出し直す
   └── バックグラウンドで POST /api/notion-sync（追記した日は前の日記も含めた本文全体）
         └── Notion にページ作成（同期済みなら同じページを更新 — 重複作成なし）
               ├── 本文は 2000 文字ごとの段落ブロックに分けて送る（切り捨てない）
               └── 同期済みのページは、本文をアプリの日記で丸ごと置き換える
                   （Notion でそのページの本文に直接書いた内容は消える）
         ※ Notion 同期が失敗しても日記の保存には影響しません
```

---

## AI 清書（本人の言葉を残す）

AI は日記の「代筆者」ではなく「清書係」です。チェックインで書いたメモを、**本人の言葉・言い回し・語尾・時制・口調のまま**つなげて読みやすく整えます（`lib/draft-prompt.ts`）。

- 手を加えるのは「単語や箇条書きを文につなぐ最小限の助詞・接続語」「明らかな誤字の修正」「順番の入れ替え・段落分け」だけ
- 書いていない出来事・感情・気づき・締めの一文（「明日も頑張ろう」など）は足さない
- 長さは入力とほぼ同じ（短く書けば短い日記になる）。`temperature: 0.3` で言い換えを抑える
- 過去の日記を文体見本として使うのはやめた（見本の大半が AI の文章で、AI 調を強めていたため）

> 以前は「500 文字程度・気持ちや内省を添えてよい」という指示だったため、短い入力ほど AI の文章に置き換わっていました。清書の方針に変えたとき（コミット `de2308c`）に合成データのメモで手作業で比べたところ、メモの残存率が 37〜44% → 96〜100%、出力の長さが入力の 5〜24 倍 → 1.0〜1.2 倍になりました。
> ただしこれは**過去の手作業の計測**で、使ったメモ・出力・モデル・数え方の記録はリポジトリに残っていないため、このままでは再現できません。また残存率は「メモのうち清書に残った割合」（いまの比べる画面の「メモの ◯% を使っています」、評価スクリプトの「メモの残り」にあたる数字）で測ったもので、AI が足した言葉の多さは反映していません。いまの見出しの数字「あなたの言葉 ◯%」も含めて測るには、[清書プロンプトの評価](#清書プロンプトの評価)の `npm run eval:draft` を使い、その結果を[基準値](#基準値の記録)として残してください。

下書き画面では、清書が本当に自分の言葉かを確かめられます（`lib/draft-compose.ts`。AI を使わない計算）。

- **整え方**: 原文のまま（メモをそのまま）／整える（AI 清書）／箇条書き（一文ずつ「・」）
- **あなたの言葉 ◯%**: 日記の本文のうち、**本人の言葉が占める割合**。メモを句ごとに 3 文字単位で突き合わせ、メモに無い言葉のうち AI が出した言葉を「AI が足した言葉」として数えるので、AI が言葉を水増しするとその分だけ下がる
  - 文をつなぐだけの短いひらがな（「で」「が」など 2 文字以内）は AI の言葉として数えない
  - 句の途中に助詞が 1 文字挟まっただけのもの（「朝ジム」→「朝はジム」）は本人の言葉として扱い、挟まった「は」はつなぎとみなす
  - 下書き画面で本文に**自分で書き足した言葉は、本人の言葉として数える**。アプリはこの下書きで AI が出した文章（清書・書き直し）を覚えておき（`stores/checkin.ts` の `aiText`。端末に保存）、メモに無い言葉のうち、その AI の文章にも出てくる言葉だけを「AI が足した言葉」にする
- **比べる画面**（メーターを押すと開く）: いまの本文と元のメモを並べて見られる。AI が足した言葉には下線、つなぎの助詞には点線が引かれる（自分で書き足した言葉には印が付かない）。あわせて「メモの ◯% を使っています・AIが足した言葉 N字」（メモのうち本文に残った割合と、つなぎを除いた AI が足した言葉の文字数）を表示
- **元に戻す**: 整え方の切り替えや AI 書き直しの前の本文に戻せる（10 段階まで）

> 以前は「メモのうち清書に残った割合」だけを「あなたの言葉」として表示していたため、メモをすべて使ったうえで AI が文を大きく足しても 100% と出ていました。いまは見出しの数字を「本文のうち本人の言葉の割合」にし、メモの残存率は比べる画面の補助の数字にしています。

AI らしく膨らませた文章がほしい日は、下書き画面の「感情豊かに ✨」などの書き直しボタンを使ってください。

---

## AI 内省ガイド（入力を深掘りする1問）

日記を「出来事ログ」で終わらせず、**感情の理由・価値観**まで残すための仕組み。チェックイン後・日記生成の前に、AI が入力を読み「足りていない1点」だけを質問します。蓄積すると、将来 AI が「あなたが何を大切にしているか」を読み取る素材になります。

### 仕組み

```
チェックイン入力（書いている間）
   └─ 入力が止まって約 2 秒後、裏で POST /api/checkin-question を先に呼んでおく（先読み）
        │  （gpt-oss-120b / JSON モード。同じ入力なら 1 回だけ、入力が変わったら作り直す）
        ├─ 十分書けている / ほぼ空 / 失敗 → 質問せず通過（skip）
        └─ 足りない1点があれば → 1問＋3〜4択を返す
下書き画面
   └─ 先読みした問いが届いていればすぐ表示（まだなら届くまで最大 7 秒待つ）
   └─ ユーザーが選ぶ（＋任意で一言／スキップ可）
   └─ 回答を生成プロンプトに渡して日記を生成
   └─ 保存時に freeform へ畳んで残す（DB 列は増やさない）
```

以前は下書き画面に来てから問いを作りはじめていたため、最大 7 秒の待ち画面が出ていました。いまはメモを書いている間に用意しておくので（`lib/reflection-prefetch.ts`）、たいていは待たずに問いが出ます。

### 何を聞くか（最も欠けている1点）

- 感情はあるが「なぜそう感じたか」が無い
- 出来事はあるが「どう感じたか」が無い
- 迷い／選択はあるが「何を優先したか」が無い
- 感謝はあるが「その何が嬉しかったか」が無い

### 設計上の約束

- **質問は1問だけ**。選択肢は候補（決めつけない）＋「どれも近くない」を必ず付与。
- **絶対にブロックしない**: 質問生成が失敗・遅延（7 秒）・未ログイン・GROQ 未設定なら、黙って日記生成へ進む。先読みしていても、この 7 秒の上限は安全網として残している。
- **DB 変更なし**: 回答は `freeform` に畳み、`diary_entries` のスキーマは据え置き。
- すでに今日の下書きがある状態（`/draft` 再訪）では質問しない。

> 💡 入力が極端に短い（本文の合計 4 文字未満）と質問は出ません。一文くらい書くと「なぜ？」が出やすいです。

---

## 音声入力（音声で日記を書く）

チェックインのテキスト欄（出来事・困ったこと等）では 🎤 ボタンから**音声で入力**できます。話した内容がテキストに変換され、欄に挿入されます。

### 仕組み

```
🎤 タップ（録音開始）
   └─ MediaRecorder で端末のマイク音声を録音
🎤 再タップ（録音停止）
   └─ 録音データ（音声ファイル）を POST /api/transcribe へ送信
        └─ サーバーで GROQ Whisper が文字起こし（日本語）
   └─ 返ってきたテキストを入力欄に挿入
```

ボタンは 3 状態：**🎤 グレー（待機）→ 🔴 赤・点滅（録音中）→ ⏳ スピナー（変換中）→ 待機に戻る**。録音は 60 秒で自動停止し、画面遷移時にはマイクを確実に解放します。

### なぜ Whisper（サーバー文字起こし）なのか

以前はブラウザ標準の **Web Speech API** を使っていましたが、**iPhone のホーム画面 PWA（standalone）では Web Speech API が動かず、ボタンが赤いまま固まる**既知の不具合がありました（API は存在するのに `onresult` / `onend` / `onerror` がどれも発火しない）。

そこで「**端末で録音 → サーバーで GROQ Whisper が文字起こし**」方式に変更しました。録音に使う `MediaRecorder` は iOS の PWA でも動くため、**iPhone・Android・PC すべてで安定動作**します。文字起こしの精度も Web Speech より高く、長めの発話にも対応できます。

### API キーは追加で必要？ → **不要**

音声文字起こしは **日記生成と同じ `GROQ_API_KEY` を使い回します**。新しい API キーやアカウント、別サービスの登録は一切要りません。すでに日記生成が動いているなら、音声入力もそのまま動きます。

- **使用モデル**: `whisper-large-v3-turbo`（高速・低コスト。日本語も実用十分）
- **速度・コスト**: 1 回の文字起こしは数百ミリ秒〜数秒。GROQ の無料枠で問題なく使えます
- **AI 日記生成と同じ BFF 経由**: 音声ファイルは必ず Next.js サーバー（`/api/transcribe`）を通して GROQ へ送られ、API キーはブラウザに出ません
- **GROQ_API_KEY 未設定時**: 音声入力は `503`（「音声入力は現在利用できません」）を返すだけで、アプリ自体は壊れません（AI が使えなくても書いたメモのまま日記にできる清書と同じ考え方。テキストで入力すれば記録できます）

精度を最優先したい場合だけ、環境変数でより重いモデルに変更できます（[AI モデルを差し替えたい](#ai-モデルを差し替えたい日本語品質速度コスト調整)参照）：

```env
GROQ_MODEL_TRANSCRIBE=whisper-large-v3   # turbo より高精度・低速
```

### ⚠️ 重要：HTTPS が必須（ローカルテストの落とし穴）

ブラウザのマイク取得（`getUserMedia`）は**セキュアコンテキスト（HTTPS か localhost）でしか動きません**。これは Web 標準のセキュリティ制約で、コードでは回避できません。

| アクセス方法 | マイク | 用途 |
|------|:----:|------|
| `http://localhost:3000`（PC） | ✅ | 開発中の動作確認はここで |
| `https://<your-app>.vercel.app`（本番 PWA） | ✅ | **iPhone 実機テストはこれ** |
| `http://192.168.x.x:3000`（LAN の生 HTTP） | ❌ | 「マイクの使用が許可されていません」になる。バグではなく仕様 |

そのため、**iPhone 実機での音声入力テストは本番（HTTPS）へデプロイしてから**行ってください。PC では `localhost` でそのまま確認できます。

> ✅ サーバー側（GROQ Whisper による文字起こし）は実音声で検証済みです。日本語音声 → 正確な文字起こしが数百ミリ秒で返ること、未認証アクセスが `401` で弾かれることを確認しています。実機で確認が残るのは「🎤 をタップして喋る」ブラウザ操作の部分のみです。

---

## セットアップ手順

### 前提条件

- Node.js 20.19 以上（推奨 22。CI も 22）。`node -v` で確認
  - アプリ本体（Next.js 15）は Node.js 18.18 以上でも動きますが、単体テスト（`npm test`。vitest 3 が使う vite 7 が Node.js 20.19 以上、22 系なら 22.12 以上を求める）と[清書プロンプトの評価](#清書プロンプトの評価)（`npm run eval:draft`。Node.js 20.12 以上）を動かすには 20.19 以上が必要です

### ステップ 1 — 依存パッケージをインストール

```bash
npm install
```

### ステップ 2 — Supabase を設定する

#### 2-1. プロジェクト作成

1. [supabase.com](https://supabase.com) でアカウント作成 → **New project** を作成
2. 作成完了まで約 1 分待つ

#### 2-2. データベースを初期化

1. 左メニュー **SQL Editor** を開く
2. `supabase/migrations/` 内の SQL を**番号順に**すべて実行する
   - `001_init.sql` （テーブル・RLS・トリガー）
   - `002_google_refresh_token.sql` （Google Calendar 連携用）
   - `003_push_subscriptions.sql` （プッシュ通知の購読情報）

#### 2-3. API キーを控える

**Project Settings → API** から以下をコピー：

| 変数名 | 場所 |
|--------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project API Keys → `anon / public` |

#### 2-4. Redirect URL を登録（必須）

> **ここを忘れるとログイン後にエラーになります。**

Supabase → **Authentication → URL Configuration → Redirect URLs** に追加：

```
http://localhost:3000/auth/callback
```

#### 2-5. Google 認証を設定する（任意）

> Apple 認証のみ使う場合はスキップできます。

**Google Cloud Console 側：**

1. [console.cloud.google.com](https://console.cloud.google.com) → プロジェクト作成
2. **APIs & Services → OAuth consent screen** → External で保存
3. **Credentials → Create Credentials → OAuth client ID** → Web application
4. **Authorized JavaScript origins** に `http://localhost:3000` を追加
5. **Authorized redirect URIs** に以下を追加：
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```
6. 表示された **Client ID・Client Secret** をメモ

**Supabase 側：**

**Authentication → Providers → Google** を有効化 → Client ID・Client Secret を入力して保存

> 📅 カレンダー連携も使う場合は、Google Cloud Console で **Google Calendar API** を有効化してください（APIs & Services → Library → Google Calendar API → Enable）。

### ステップ 3 — GROQ API キーを取得

1. [console.groq.com](https://console.groq.com) でアカウント作成（無料枠あり）
2. **API Keys → Create API Key** → `gsk_...` 形式のキーをメモ

### ステップ 4 — 環境変数ファイルを作成

```bash
# Mac / Linux
cp .env.local.example .env.local

# Windows
Copy-Item .env.local.example .env.local
```

`.env.local` を開いて各値を入力：

```env
# Supabase（必須）
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# GROQ（必須 — AI 日記生成・書き直し・分析・週次レポート・音声文字起こし）
# ※ 音声入力もこの 1 つのキーで動きます。追加のキーは不要です
GROQ_API_KEY=gsk_...

# シークレット暗号化キー（推奨 — Notion トークン等を DB に暗号化保存）
# openssl rand -base64 32 などで生成したランダム文字列
# 未設定だとトークンは暗号化されずに平文で保存される（保存のたびにサーバーのログに警告が出る）
ENCRYPTION_KEY=

# Notion（任意 — アプリの設定画面からでも入力できます）
NOTION_API_KEY=secret_...
NOTION_DATABASE_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Google Calendar（任意）
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
```

> ⚠️ `GROQ_API_KEY` などのシークレットはサーバー専用です。`NEXT_PUBLIC_` プレフィックスを絶対に付けないでください（付けるとブラウザに公開されます）。

### ステップ 5 — 開発サーバーを起動

```bash
npm run dev
```

`http://localhost:3000` を開いてログインできれば完了です。

---

## Notion 連携（任意）

設定方法は 2 通り。どちらか 1 つで OK。

| 方法 | 向いているケース |
|------|----------------|
| アプリの設定画面から入力 | 自分だけが使う個人利用（トークンは暗号化して DB 保存） |
| `.env.local` に記述 | 全ユーザー共通のデフォルト値として使いたい場合 |

### Notion インテグレーションの作成

1. [notion.so/my-integrations](https://www.notion.so/my-integrations) → **New integration** を作成
2. 表示された **Internal Integration Token**（`secret_...`）をコピー
3. 同期先の Notion データベースを開く → 右上 **...** → **接続先を追加** → 作成したインテグレーションを選択
4. データベース URL から ID（末尾 32 文字）をコピー：
   ```
   https://www.notion.so/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx?v=...
                          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ ← DB ID
   ```

### Notion データベースの必須プロパティ

名前が 1 文字でも違うと同期に失敗します。

| プロパティ名 | 型 |
|------------|-----|
| タイトル | タイトル（デフォルト） |
| 日付 | 日付 |
| 気分 | 数値 |
| エネルギー | 数値 |
| タグ | マルチセレクト |

### 同期のしくみと注意

- 日記を保存したとき（同じ日に追記したとき・日記の詳細画面で本文を直したときも）に、その日の日記の本文全体を Notion に送ります。1 日 1 ページで、同期済みの日（`diary_entries.notion_page_id` がある日）は同じページを更新します
- ⚠️ **同期済みのページは、本文をアプリの日記で丸ごと置き換えます。** ページ本文の既存ブロックをすべて削除してから書き直すので、Notion でそのページの本文に直接書き足した内容は、次の同期で消えます。Notion 側で残したいメモは、同期されるページの本文ではなく別のページに書いてください（上の表のプロパティもアプリの値で更新されます）
- 本文が 2000 文字（Notion の段落 1 つに入る上限）を超える日は、段落（空行）の切れ目で **2000 文字ごとの段落ブロックに分けて**送ります。切り捨てはしません（1 回に送れる 100 ブロック、およそ 20 万文字まで。以前は 2000 文字で切っていたため、追記で長くなった日の後半が届きませんでした。`lib/notion-blocks.ts`）

---

## プッシュ通知（リマインダー）の設定

「記録がまだの日だけ、夜にそっと通知する」Web Push リマインダー。**iPhone は iOS 16.4 以降で「ホーム画面に追加」した PWA からのみ**利用できます（Web 標準の制約）。

### 仕組み

```
設定画面でトグル ON
   └─ Notification.requestPermission → Service Worker が Push 購読
   └─ POST /api/push/subscribe → push_subscriptions テーブルに保存（端末ごと）

Vercel Cron（毎日 12:00 UTC = 21:00 JST）
   └─ GET /api/cron/reminder（CRON_SECRET で認証）
        ├─ 今日（JST）記録済みのユーザー → スキップ（通知しない）
        ├─ 昨日の気分があれば文面に差し込む（「昨日の気分は🙂でした…」）
        └─ 期限切れの購読（410/404）は自動削除
```

### セットアップ（3 ステップ）

1. **VAPID キーを生成**して環境変数に設定（ローカルは `.env.local`、本番は Vercel）:
   ```bash
   npx web-push generate-vapid-keys
   ```
   ```env
   NEXT_PUBLIC_VAPID_PUBLIC_KEY=B...
   VAPID_PRIVATE_KEY=...
   VAPID_SUBJECT=mailto:you@example.com
   CRON_SECRET=ランダムな文字列
   SUPABASE_SERVICE_ROLE_KEY=（Supabase → Project Settings → API → service_role）
   ```
2. **マイグレーション実行**: Supabase SQL Editor で `003_push_subscriptions.sql` を実行
3. **デプロイ**: `vercel.json` の crons 設定が有効になる（Hobby プランは 1 日 1 回・時刻は概ね 21 時ごろ）

> 💡 手動で配信テスト: `curl -H "Authorization: Bearer <CRON_SECRET>" https://<your-app>/api/cron/reminder`
> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` は RLS をバイパスする管理キーです。サーバー専用・`NEXT_PUBLIC_` 禁止。

---

## Vercel へのデプロイ

```bash
npm i -g vercel
vercel
```

または GitHub リポジトリを Vercel に連携すると、push のたびに自動デプロイされます。

### デプロイ後の追加設定（3 つ）

**1. 環境変数を登録**

Vercel → **Settings → Environment Variables** に `.env.local` の内容をそのまま登録。
プッシュ通知を使う場合は `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` / `CRON_SECRET` / `SUPABASE_SERVICE_ROLE_KEY` も忘れずに（[設定方法](#プッシュ通知リマインダーの設定)）。

**2. Supabase に本番 URL を追加**（必須 — 忘れると本番でログイン不可）

**Authentication → URL Configuration → Redirect URLs** に追加：

```
https://<your-vercel-domain>.vercel.app/auth/callback
```

**3. Google Cloud Console に本番 URL を追加**（Google 認証を使う場合）

**Credentials** → OAuth クライアント → **Authorized JavaScript origins** に追加：

```
https://<your-vercel-domain>.vercel.app
```

---

## iPhone のホーム画面に追加する

1. Safari でデプロイ済みの `https://` URL を開く
2. 下部の共有ボタン（□↑）をタップ
3. **「ホーム画面に追加」** → 追加

> ローカル環境（`http://localhost`）では追加できません。Vercel へのデプロイ後に行ってください。

---

## ローカルで動作確認する（手動テスト）

`npm run dev` のあと、以下を上から順に試すと主要フローを一通り確認できます。チェックが全部通れば本番デプロイして問題ありません。

### 1. 起動とログイン

```bash
npm run dev          # http://localhost:3000
npm test             # 単体テスト（vitest）
npm run typecheck    # 型チェックだけ単独で
npm run lint         # lint だけ単独で
npm run build        # 本番ビルドが通るか（型エラー・lint も同時に検査）
```

- [ ] `npm test` / `npm run typecheck` / `npm run lint` がすべて通る（[テストと CI](#テストと-ci)）

- [ ] `/` を開く → 未ログインなら `/login` にリダイレクトされる
- [ ] Google でサインインできる（→ ログインが弾かれる場合は[トラブルシューティング](#トラブルシューティング)の「Unsupported provider」へ）
- [ ] 初回ログイン直後はオンボーディング画面（3 ステップ説明）が出る

### 2. チェックイン → AI 生成 → 保存

- [ ] 気分・エネルギーをタップすると絵文字がポップする
- [ ] 2 画面目で何か書いて「日記に清書する ✨」→ **文章が 1 文字ずつ流れて表示**される（ストリーミング）
- [ ] 生成後にタグ・サマリーが表示される
- [ ] 清書の本文に自分で言葉を書き足しても「あなたの言葉 ◯%」が下がらない（比べる画面の下線は AI が足した言葉だけに付く）
- [ ] 「保存する 💾」で紙吹雪が出て保存完了 → 日記詳細が開ける
- [ ] 同じ日にもう一度チェックイン → 下書き画面に「保存すると、前の日記のあとに追記されます」のお知らせが出てボタンが「追記して保存する 💾」になり、保存すると**エラーにならず追記**され「今日の日記に追記しました」と出る（前の本文・メモ・ふりかえりが書いたまま残っている／2 回目保存の確認）
- [ ] 「気分だけで記録する」で保存した日にもう一度チェックイン → 追記ではなく、そのまま本文が書き込まれる

### 3. 一覧・分析・編集

- [ ] ホームに水鏡のヒーロー（時間帯で空の色が変わる・その日の月）、この一週間・数字の帯・記録の軌跡・気分の波が出る
- [ ] `/entries` に月別で一覧が出る
- [ ] `/insights` で「分析する」→ AI パーソナル分析（5 件以上の記録が必要）
- [ ] `/insights` の「過去30日の記録ペース」に、記録した日数と「うち言葉つき N日」が出る
- [ ] 日記詳細で本文を編集して保存できる

### 4. 異常系（壊れないことの確認）

- [ ] `.env.local` の `GROQ_API_KEY` を一時的にコメントアウト → 「AI に接続できませんでした」と出て、**書いたメモがそのまま本文**になる（メモが空ならテンプレート。クラッシュしない）
- [ ] 存在しない URL（例 `/xxxx`）→ ブランドの「ページが見つかりません」画面が出る

> 💡 Notion 同期は実際の Notion 連携が必要です。設定画面でトークンと DB ID を入れてから保存すると、数秒後に `diary_entries.notion_page_id` が埋まります（Supabase の Table Editor で確認可能）。同期済みの日にもう一度保存すると、Notion のページ本文はアプリの日記で置き換わります（Notion で直接書いた本文は消える。[同期のしくみと注意](#同期のしくみと注意)）。

---

## テストと CI

```bash
npm test             # 単体テスト（vitest。tests/ 以下の *.test.ts）
npm run typecheck    # 型チェック（tsc --noEmit）
npm run lint         # ESLint（next lint）
```

- テストの対象は `lib/` の純粋関数（日本時間の日付処理、「あなたの言葉 ◯%」の計算、同じ日の追記、自由メモの分解、Notion に送る本文の分け方、ログイン後の戻り先の検査など）。DOM は使わず node 環境で動きます（設定は `vitest.config.ts`）
- テストの実行には Node.js 20.19 以上が必要です（[前提条件](#前提条件)。CI は Node.js 22）
- 日付まわりは、日本・UTC（Vercel のサーバー）・アメリカ西海岸のタイムゾーンで同じ結果になるかも確かめています
- **GitHub Actions**（`.github/workflows/ci.yml`）が、push と Pull Request のたびに **lint → typecheck → test → build** の順で実行します
- CI と Vercel のデプロイは別々に動きます（CI が失敗しても、`main` への push はそのまま本番に出ます）。push の前に手元で `npm test` まで通しておいてください

---

## 清書プロンプトの評価

清書のプロンプト（`lib/draft-prompt.ts`）が「本人の言葉を残す」ことを守れているかを、実際の GROQ API で確かめるスクリプトです（`scripts/eval-draft.ts`）。架空の見本のメモ 10 件（キーワードだけ・箇条書き・話し言葉・です・ます調・長め・ふりかえりつき・過去の日付・誤字ありなど）を、本番の `/api/generate-draft` と同じプロンプト・同じ生成パラメータで 1 件ずつ清書し（ストリーミングはしない）、AI を使わない計算（`lib/draft-compose.ts` の `analyzeKept`）で採点します。

**Node.js 20.12 以上が必要**です（`.env.local` の読み込みに `process.loadEnvFile` を使うため。古い Node ではその旨を表示して終了します）。`.env.local` が無ければ、すでに設定されている環境変数だけで動きます。モデルは `GROQ_MODEL_QUALITY` で上書きできます。CI では実行していません（API キーが要るため）。

```bash
npm run eval:draft                  # 全ケースを 1 回ずつ清書して採点（GROQ_API_KEY が必要。.env.local があれば読み込む）
npm run eval:draft -- --runs 3      # 1 件あたりの清書の回数（1〜20。同じメモでも出力がぶれるため）
npm run eval:draft -- --show        # すべての清書を表示（AI が足した言葉を［］で囲む。印が付いたものは指定しなくても表示）
npm run eval:draft -- --mock        # API を呼ばず、メモをそのまま清書とみなす（キーなしで配線だけ確かめる。全件 100%・1.00 になる）
npm run eval:draft -- --no-fail     # 印が付いたものがあっても終了コードを 0 にする
```

結果は次のような表で出ます（`--mock` の出力の一部）。

```
ケース            回  本人の言葉  メモの残り  長さの比  メモ→清書  秒  判定
----------------  --  ----------  ----------  --------  ---------  --  ----
キーワードだけ     1        100%        100%      1.00        6→6   -  OK
ひと言だけ         1        100%        100%      1.00        8→8   -  OK
…
平均（10件）: 本人の言葉 100% / メモの残り 100% / 長さの比 1.00
要確認: 0 / 10 件
```

| 列 | 意味 |
|------|------|
| 本人の言葉 | 清書のうち本人の言葉の割合（下書き画面の「あなたの言葉 ◯%」と同じ計算。下書き画面で自分で書き足す前の数字にあたる）。AI が文を足すと下がる |
| メモの残り | メモのうち清書に残った割合（比べる画面の「メモの ◯% を使っています」と同じ計算）。メモが削られると下がる |
| 長さの比 | 清書の文字数 ÷ メモの文字数。**空白・句読点・記号は数えない**（句読点が足されただけで長くなったと扱わない）。水増しすると大きくなる |
| メモ→清書 | 長さの比のもとになった文字数（空白・句読点・記号を除く） |
| 秒 | 1 件の清書にかかった時間（`--mock` では `-`） |
| 判定 | `OK` か `要確認（理由）` |

**本人の言葉が 85% 未満、長さの比が 1.5 を超えたもの、空の出力、API の失敗**に「要確認」の印が付きます（前の 2 つは AI が言葉を足しすぎている目安）。表のあとに平均（清書が返ってきたものだけで計算）と要確認の件数を出し、印の付いた清書は AI が足した言葉を［］で囲んで表示します（つなぎの助詞は囲まない）。**印が 1 件でもあれば終了コード 1** になります（`--no-fail` のときは 0）。

プロンプトを変えたとき・`GROQ_MODEL_QUALITY` を変えたとき（Groq のモデル廃止で差し替えたときも）は、必ず実行して下の基準値より数字が落ちていないか確かめてください。

### 基準値の記録

まだ実際の API での基準値は記録していません（[AI 清書](#ai-清書本人の言葉を残す)にある 37〜44% → 96〜100% などの数字は、このスクリプトができる前の手作業の計測で、再現できるデータは残っていません）。GROQ のキーがある環境で `npm run eval:draft -- --runs 3` を実行し、最後に出る「平均」の行と「要確認」の件数を、モデル名（出力の「モデル:」の行）・日付・`--runs` の回数とあわせてこの表に書き足してください。プロンプトやモデルを変えたときは、同じ `--runs` で実行してこの表と比べます。

| 日付 | モデル | --runs | 本人の言葉（平均） | メモの残り（平均） | 長さの比（平均） | 要確認 | 変えたこと |
|------|------|:----:|----:|----:|----:|----:|------|
| （未記録） | | | | | | | |

---

## 運用・保守

日常的に発生する作業をまとめます。「こうしたい時はどこを触る？」の早見表です。

### AI モデルを差し替えたい（日本語品質・速度・コスト調整）

モデル ID は `lib/groq.ts` の `GROQ_MODELS` で一元管理しています。コードを変えずに**環境変数で上書き**もできます。

```env
# .env.local（または Vercel の環境変数）
GROQ_MODEL_QUALITY=openai/gpt-oss-120b                 # 日記生成・分析・書き直し
GROQ_MODEL_FAST=openai/gpt-oss-20b                     # タグ抽出など軽量タスク
GROQ_MODEL_TRANSCRIBE=whisper-large-v3-turbo           # 音声入力の文字起こし（既定）
```

| 目的 | おすすめ `GROQ_MODEL_QUALITY` |
|------|------|
| 日本語が自然で JSON も安定（既定） | `openai/gpt-oss-120b` |
| さらに軽く・速く | `llama-3.3-70b-versatile` |

> ⚠️ **Groq はモデルを頻繁に廃止・改名します。** 以前の既定 `moonshotai/kimi-k2-instruct-0905` は廃止され、指定すると `404` で毎回清書に失敗していました。清書が急に毎回「AI に接続できませんでした」になり、書いたメモがそのまま本文になる（メモが空ならテンプレート）ようになったら、まず[利用可能モデル一覧](https://console.groq.com/docs/models)に現在の `GROQ_MODEL_QUALITY` が載っているか確認してください。`qwen/qwen3-32b` は reasoning モデルで `<think>` タグが本文に混入し JSON モードも壊れるため非推奨です。

- 最新の利用可能モデルは [console.groq.com/docs/models](https://console.groq.com/docs/models) で確認（モデルは頻繁に入れ替わります）
- **JSON モードのルート（`draft-meta` / `rewrite-draft` / `analyze` / `weekly-report` / `checkin-question`）と日記生成（`generate-draft`）は `reasoning_effort: 'low'` を必ず付ける**。gpt-oss 系は reasoning が JSON 出力を壊し `400 json_validate_failed` を起こすため（付けないと毎回失敗してフォールバックになる。清書なら「AI に接続できませんでした」で書いたメモのまま、タグ・要約なら気分・エネルギーをもとにした簡単なものになる等の劣化）。あわせてプロンプトに「JSON」の語を必ず含める（Groq の JSON モード要件）。モデルを差し替える時もこの2点を維持すること
- **モデル ID を間違えても安全**: 生成は書いたメモそのまま（空ならテンプレート）に、JSON 系は各フォールバックに自動で切り替わります（白画面にはならない）

### 見た目（配色・フォント）を変えたい

ホームは「**水鏡（みずかがみ）**」— 上半分の空に縦書きの日付と**その日の本当の月**（月齢・和名つき）、下半分の水面がそれを揺らぎながら映す。空と水の色は時間帯（夜明け 4–7 時／昼 7–16 時／夕暮れ 16–19 時／夜）で変わり、水面に触れると波紋が広がる。下には和紙のシートが重なり、週・数字・記録の軌跡・気分の波を編集誌のような組版で並べる。全体の配色は「和紙と墨」（クリームの紙＋墨の文字＋セージ／金のアクセント）で、**CSS 変数で一元管理**している。

| 変えたいもの | 触る場所 |
|------|------|
| ページ／カード／文字色・罫線（和紙・墨・セージ・金） | `app/globals.css` の `:root`（ダークは `.dark`） |
| ホームの空と水の色（時間帯ごと）・映り込み・月の道・波紋 | `components/home/home.css` の `.im-mirror[data-period=…]` ほか |
| ホームの構成（ヒーロー／シートの各セクション） | `components/home/HomeView.tsx` / `MirrorHero.tsx` / `HomeSections.tsx` |
| 月齢・月の形・漢数字の日付 | `lib/almanac.ts` |
| 浮いたカプセル型ナビ・アイコン | `components/ui/BottomNav.tsx` ＋ `app/globals.css` の `.nav-*` |
| Tailwind の `primary` / `surface` 階調 | `tailwind.config.ts` |
| 気分・エネルギーの色ランプ（アース系 `#b5654a`→`#6f8a5f`） | `lib/constants.ts` の `MOODS` / `ENERGY` |
| フォント（Cormorant Garamond ＋ Shippori Mincho ＋ Zen Kaku Gothic New） | `app/layout.tsx`（Google Fonts の `link`）＋ `app/globals.css` の `.font-*` |
| iOS ステータスバー色（theme-color） | `app/layout.tsx` の `<meta name="theme-color">` |

> テーマは設定画面で「自動／ライト／ダーク」を選べます（「自動」は OS 設定に追従）。切り替えは `<html>` の `.dark` クラスだけで行います。
>
> 💡 **モックデータでホームのデザインを確認する**: `npm run dev` で `/dev/home` を開くとモックデータで表示できます（開発時のみ・本番は 404）。Supabase の環境変数が設定されていればふつうのページと同じくログインが必要で、ログインなしで開けるのは `.env.local` に Supabase の URL / ANON_KEY が無いとき（開発時は認証を素通しする）だけです。`?h=6`（時刻）・`?date=2026-12-24`（日付）・`?state=recorded|moodonly|new`（今日記録済み／気分だけ記録済み／初回）で状態を切り替えられます。

### ログイン方法を追加・変更したい

- **メール+パスワード**を足したい → Supabase の **Authentication → Providers → Email** を有効化（外部設定が不要で一番手軽）
- **Apple サインイン**を有効化 → Apple Developer Program（年 99 USD）が必要。未契約なら `app/login/page.tsx` の Apple ボタンを隠すのが無難
- いずれも Supabase 側でプロバイダを Enable にしないと「Unsupported provider」エラーになります

### DB スキーマを変更したい

1. `supabase/migrations/` に連番で新しい `.sql` を追加（例 `003_xxx.sql`）
2. Supabase の **SQL Editor** で実行
3. RLS が必要なテーブルは必ず `enable row level security` とポリシーをセットで書く（既存マイグレーションが手本）

### 依存パッケージを更新したい

```bash
npm outdated          # 古いパッケージを確認
npm update            # マイナー/パッチ更新
npm run build         # 更新後に必ずビルドが通るか確認
```

メジャーバージョン更新（Next.js など）は破壊的変更があり得るので、`npm run build` と[手動テスト](#ローカルで動作確認する手動テスト)を必ず通してからデプロイしてください。

### ログ・障害調査

- **ローカル**: `npm run dev` のターミナルに `console.error` が出ます（`GROQ ... error` / `Notion sync error` など）
- **本番**: Vercel ダッシュボード → **プロジェクト → Logs**（または該当 Deployment → Functions）で API ルートのログを確認
- 清書が毎回「AI に接続できませんでした」になる／Notion に同期されない時は、まずここで該当ルートのエラー（`GROQ draft generation error` / `Notion sync error` など）を見るのが最短です

### コスト・レート制限

- GROQ には無料枠があり、超えると **429（レート制限）** が返ります → アプリは壊れませんが、そのあいだは清書の代わりに書いたメモがそのまま本文になり（「AI に接続できませんでした」）、タグ・要約は気分・エネルギーをもとにした簡単なものに、分析・週次レポートは統計ベースの簡易版になります
- 連続で 429 が出るなら、`GROQ_MODEL_QUALITY` を軽いモデルに切り替えるか、有料プランを検討
- Supabase・Vercel も無料枠があり、個人利用なら通常は収まります

### データのバックアップ

- 日記データは Supabase の `diary_entries` テーブルにあります
- Supabase ダッシュボード → **Database → Backups**（有料プランは自動バックアップ）
- 手動エクスポートは **Table Editor → Export to CSV**、または SQL Editor で `select * from diary_entries`

### 本番リリースの流れ

#### Vercel は「ローカル」と「Git」どちらをビルドする？

デプロイ方法で変わります。**本リポジトリは GitHub 連携（`git push` 起点）に統一**しています。

| デプロイ方法 | ビルド対象 | コミット | 本番フローで使う？ |
|------|------|:----:|:----:|
| `git push origin main` | GitHub 上のコミット | 必須 | ✅ これに統一 |
| `vercel --prod`（CLI） | 手元のローカルファイル（未コミット分も乗る） | 不要 | ❌ 使わない |

> CLI 直デプロイと Git 連携を混ぜると「Git に無い変更が本番に出ている」というズレの原因になります。CLI（`vercel --prod`）は封印し、必ず `git push` 経由でリリースしてください。`.vercel/` フォルダはリンク情報なので残っていて問題ありません（`.gitignore` 済み）。

#### 全体像

```
[ローカル PC]                    [GitHub]                 [Vercel クラウド]
 コード修正                       main ブランチ              ビルド & 配信
 npm run build  ── git push ──▶  コミット履歴  ── 自動 ──▶  本番 URL
 （手元で検証）                                  デプロイ      (.vercel/output)
     │
     └─ .env.local（ローカル専用・アップロードされない）
                                              環境変数は Vercel 側で別管理 ▲
                                              Settings → Environment Variables
```

ポイントは **ビルドはクラウドで実行される**こと。ローカルの `.env.local` は一緒に上がりません。

#### リリース手順

```bash
npm test                  # 1. 単体テストが通るか
npm run build             # 2. 本番と同じビルドが通るか（型・lint も検査）
# 3. 手動テスト（上記チェックリスト）
git add -A
git commit -m "..."
git push origin main      # 4. これがトリガー → Vercel が自動ビルド&本番反映（GitHub Actions の CI も走る）
```

- **`main` への push = 本番デプロイ**。他ブランチに push すると本番に影響しないプレビュー URL が生成される（試運転に便利）
- CI の結果を待たずにデプロイされるので、`npm test` は push の前に手元で通しておく（[テストと CI](#テストと-ci)）
- リリース後は Vercel ダッシュボードでデプロイの成功を確認

#### 環境変数を変えた時（重要）

`.env.local` は**ローカル専用で本番には反映されません**。本番にも効かせるには：

1. Vercel → **Settings → Environment Variables** に同じキーを登録（例: 今日変えた `GROQ_MODEL_QUALITY`）
2. **Redeploy**（環境変数はビルド時に取り込まれるため、登録しただけでは反映されない）

---

## 環境変数なしでの動作

| 機能 | 環境変数なし | 環境変数あり |
|------|:----------:|:----------:|
| チェックイン入力 | ✅ | ✅ |
| AI 日記生成 | 書いたメモをそのまま本文に（空ならテンプレート） | GROQ API |
| AI 分析・週次レポート | 統計ベースの簡易版（⚠️ 注記付き） | GROQ API |
| AI に聞いてみる | ❌ 503（利用不可） | ✅ GROQ API |
| 音声入力（🎤） | ❌ 503（利用不可） | ✅ GROQ Whisper |
| プッシュ通知 | ❌（トグルに案内表示） | ✅ VAPID キー設定時 |
| データ保存 | ❌ Supabase 必須 | ✅ |
| Notion 同期 | スキップ | ✅ |
| 認証 | ❌ ログインで停止 | ✅ |

---

## セキュリティ設計

| 項目 | 仕組み |
|-----|--------|
| AI / Notion の API キー | Vercel 環境変数（サーバー専用）。API Routes からのみアクセス |
| ユーザーの Notion トークン | `ENCRYPTION_KEY` で AES-256-GCM 暗号化して DB 保存。クライアントには返さない。`ENCRYPTION_KEY` 未設定時は平文で保存され、サーバーのログに警告が出る |
| Google リフレッシュトークン | 同上（暗号化して DB 保存） |
| データ分離 | Supabase RLS — DB レベルで「自分の行しか読み書きできない」を強制 |
| セッション | HTTP-only Cookie（JS から読み取り不可） |
| 未認証アクセス | middleware がページは `/login` へリダイレクト、API は 401 JSON を返却 |
| ログイン後の戻り先 | `/auth/callback` の `?next=` は、このサイト内のパス（`/〜`）だけを受け付ける。`//evil.com` や `/\evil.com`、`/.//evil.com`（正規化すると `//` で始まる）のように外部サイトへ飛ばせる値は `/` に置き換える（`lib/safe-redirect.ts`） |

**RLS（Row Level Security）とは**: アプリのコードにバグがあっても他ユーザーのデータが漏れないよう、DB 側でアクセス制御を強制する仕組みです。

```sql
create policy "entries: own rows only"
  on public.diary_entries
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

---

## データベース構造

### `profiles` — ユーザー設定

| カラム | 型 | 説明 |
|-------|-----|------|
| id | uuid | Supabase Auth の user ID と一致 |
| notion_token | text | Notion トークン（暗号化済み） |
| notion_database_id | text | 同期先 Notion DB の ID |
| google_refresh_token | text | Calendar 連携用（暗号化済み） |
| notification_time | time | 通知時刻（例: `21:00`） |
| timezone | text | デフォルト `Asia/Tokyo` |

### `diary_entries` — 日記データ

1 ユーザー・1 日・1 エントリー（`UNIQUE(user_id, entry_date)`）。日付は JST 基準。同じ日の2回目以降の保存は、言葉のある日記があれば上書きせず、本文・メモの列に追記する（`lib/entry-merge.ts`）。そのとき `summary` / `dominant_emotion` は前の値を残し、AI が本文全体から作れた項目だけを書き換える。

| カラム | 型 | 説明 |
|-------|-----|------|
| entry_date | date | 日付（YYYY-MM-DD） |
| mood / energy | int2 | 気分・エネルギー 1〜5 |
| events / challenges / gratitude / freeform | text | チェックイン入力 |
| ai_draft | text | AI 生成の原文 |
| edited_draft | text | ユーザー編集後の最終文 |
| tags | text[] | AI 抽出タグ |
| summary / dominant_emotion | text | AI 生成のサマリー・主要感情 |
| notion_page_id / notion_synced_at | text / timestamptz | Notion 同期状態 |

### `push_subscriptions` — Web Push 購読（端末ごと）

| カラム | 型 | 説明 |
|-------|-----|------|
| user_id | uuid | 購読者 |
| endpoint | text | Push サービスの URL（unique） |
| p256dh / auth | text | 暗号化キー |

---

## ファイル構成

```
├── app/
│   ├── page.tsx                 # ホーム（統計・チャート・フラッシュバック・書き忘れ導線）
│   ├── checkin/page.tsx         # 2 画面チェックイン（過去日付 ?date= 対応）
│   ├── draft/page.tsx           # AI ドラフト確認・編集・保存
│   ├── entries/page.tsx         # 日記一覧（検索・ページング）
│   ├── entries/[date]/page.tsx  # 日記詳細（編集・削除）
│   ├── insights/page.tsx        # AI 分析・週次レポート・AIに聞く・ローカル統計
│   ├── settings/page.tsx        # 設定（通知・Notion・データエクスポート・アカウント）
│   ├── login/page.tsx           # ログイン
│   ├── auth/callback/route.ts   # OAuth コールバック（Google トークン保存・戻り先の検査）
│   └── api/
│       ├── checkin-question/    # 生成前の内省質問（GROQ・JSON・skip可）
│       ├── generate-draft/      # AI 清書（GROQ・ストリーミング・過去日付）
│       ├── draft-meta/          # タグ・サマリー・感情の抽出（GROQ）
│       ├── rewrite-draft/       # AI 書き直し（GROQ）
│       ├── analyze/             # パーソナリティ分析＋価値観抽出（GROQ）
│       ├── weekly-report/       # 週次レポート＋先週フォーカスのふり返り（GROQ）
│       ├── ask/                 # 日記への 1 問 1 答（GROQ）
│       ├── transcribe/          # 音声文字起こし（GROQ Whisper）
│       ├── notion-sync/         # Notion 同期（同期済みのページは本文を差し替える）
│       ├── calendar/today/      # Google Calendar 取得
│       ├── settings/            # 設定の読み書き（トークン暗号化）
│       ├── export/              # JSON / CSV エクスポート
│       ├── push/subscribe/      # Web Push 購読の登録・解除
│       └── cron/reminder/       # リマインダー配信（Vercel Cron から）
├── components/
│   ├── checkin/                 # StateStep / NotesStep / TextStep / ReflectionQuestion
│   ├── draft/                   # 下書き画面の部品（整え方の切り替え / あなたの言葉のメーターと比べる画面 / 保存まわり ほか）
│   ├── entry/                   # EditableContent / DeleteEntryButton
│   ├── home/                    # HomeView / MirrorHero（水鏡）/ MirrorCTA / HomeSections / home.css ほか
│   ├── insights/                # インサイト画面の各セクション（AI 分析 / 週次レポート / AI に聞く / ローカル統計）と PersonalityCard
│   └── ui/                      # BottomNav / VoiceInputButton ほか
├── lib/
│   ├── groq.ts                  # GROQ クライアント・モデル定義
│   ├── crypto.ts                # シークレット暗号化（AES-256-GCM）
│   ├── supabase.ts              # クライアント用 Supabase
│   ├── supabase-server.ts       # サーバー用 Supabase
│   ├── supabase-admin.ts        # Service Role クライアント（cron 専用）
│   ├── push-client.ts           # Web Push 購読ヘルパー（クライアント）
│   ├── api-client.ts            # fetch ラッパー（タイムアウト・リトライ）
│   ├── draft-prompt.ts          # 日記清書プロンプト（本人の言葉を残す）
│   ├── jst.ts                   # 日付の共通処理（日本時間。端末・サーバーのタイムゾーンに左右されない）
│   ├── home-model.ts            # ホーム表示用の計算（連続記録・書き忘れ・フラッシュバック）
│   ├── almanac.ts               # 月齢・月の形・漢数字
│   ├── draft-compose.ts         # 整え方（原文のまま・箇条書き）と「あなたの言葉」の比較
│   ├── entry-save.ts            # 日記の保存（気分だけの保存は本文を消さない・同じ日は追記）
│   ├── entry-merge.ts           # 同じ日の追記（前の本文・メモ・ふりかえりを書いたまま残して足す）・要約用の本文の抜粋
│   ├── freeform.ts              # 自由メモ／ふりかえり／あとからの一言の分解
│   ├── reflection-prefetch.ts   # AI 内省ガイドの問いの先読み（入力中に裏で用意しておく）
│   ├── prompt-context.ts        # 分析・週次レポート・AI に聞く に渡す日記データの整形
│   ├── safe-redirect.ts         # ログイン後の戻り先をサイト内のパスに限る
│   ├── notion-blocks.ts         # Notion 用に本文を 2000 文字ごとの段落ブロックに分ける
│   ├── focus.ts                 # 採用した「今週のフォーカス」（端末に保存）
│   └── offline-draft.ts         # AI が使えないときの日記テンプレート（メモが空のとき）と簡単なタグ・要約
├── stores/
│   ├── checkin.ts               # チェックイン状態（localStorage 永続化・対象日・整え方・この下書きで AI が出した文章 aiText）
│   ├── memos.ts                 # 今日のひとこと（端末に保存・日付が変わると持ち越さない）
│   └── settings.ts              # 端末ローカル設定のみ（サーバー設定は /api/settings）
├── middleware.ts                 # 認証ガード（ページ→リダイレクト / API→401）
├── vercel.json                   # Cron 設定（リマインダー配信）
├── supabase/migrations/          # 001_init / 002_google_refresh_token / 003_push_subscriptions
├── tests/                        # 単体テスト（vitest。lib/ の純粋関数が対象）
├── vitest.config.ts              # テストの設定（node 環境・'@/' の解決）
├── scripts/
│   └── eval-draft.ts             # 清書プロンプトの評価（npm run eval:draft）
├── .github/workflows/ci.yml      # CI（lint → typecheck → test → build）
└── public/
    ├── manifest.json            # PWA マニフェスト
    └── sw.js                    # Service Worker（静的キャッシュ + Push 受信）
```

---

## トラブルシューティング

**ログインで `Unsupported provider: provider is not enabled` が出る**
→ Supabase 側でそのログイン方法が有効化されていません。**Authentication → Providers** で使いたいプロバイダ（Google など）を Enable にし、Client ID / Secret を保存してください。Apple は Apple Developer Program への加入が必要です。

**ログイン後に `/auth/callback` でエラーになる**
→ Supabase **Authentication → URL Configuration → Redirect URLs** にローカル / 本番の URL が登録されているか確認。

**清書が毎回「AI に接続できませんでした」になる（書いたメモがそのまま本文になる・メモが空ならテンプレート／タグ・要約が気分・エネルギーをもとにした簡単なものになる）**
→ ① `GROQ_API_KEY` が正しく設定されているか確認（Vercel の場合は環境変数登録後に **Redeploy** が必要）。② Vercel/ターミナルのログに `GROQ ... error` が出ていないか確認。`429` ならレート制限なので[運用・保守のコスト項](#コストレート制限)へ。③ `404` なら `GROQ_MODEL_QUALITY` のモデルが Groq で**廃止された**可能性が大きい（指定したモデルが存在しないと毎回清書に失敗します）。[利用可能モデル一覧](https://console.groq.com/docs/models)で現在のモデル ID を確認し、`lib/groq.ts` の既定か環境変数を有効なものに更新してください（[AI モデルを差し替えたい](#ai-モデルを差し替えたい日本語品質速度コスト調整)）。清書はできるのにタグ・要約だけが簡単なものになるときは、タグ抽出に使う `GROQ_MODEL_FAST` を同じように確認します。

**日本語が不自然・硬い／急に清書の質が落ちた**
→ モデルを日本語に強いものへ差し替え。既定は `openai/gpt-oss-120b` です（[AI モデルを差し替えたい](#ai-モデルを差し替えたい日本語品質速度コスト調整)を参照）。差し替えたら[清書プロンプトの評価](#清書プロンプトの評価)で数字が落ちていないか確かめてください。

**Notion 同期されない（`notion_page_id` が null のまま）**
→ 設定画面または `.env.local` で Notion トークンと DB ID が設定されているか確認。Notion DB にインテグレーションが接続されているかも確認（DB の **...** → **接続先を追加**）。

**カレンダーの予定が取得できない**
→ 一度サインアウトして **Google で再ログイン**してください（カレンダー権限の同意とトークン保存はログイン時に行われます）。Google Cloud Console で Calendar API が有効か、`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` が設定されているかも確認。

**音声入力（🎤）が動かない・録音できない**
→ ① **HTTPS でアクセスしているか確認**。マイク取得（`getUserMedia`）はセキュアコンテキスト必須で、`http://192.168.x.x`（LAN の生 HTTP）では動きません。本番 `https://...vercel.app` か PC の `localhost` で試してください（詳細は[音声入力](#音声入力音声で日記を書く)）。② 「マイクの使用が許可されていません」→ ブラウザ / OS のマイク権限を確認（iPhone は **設定 → Safari → マイク**、PWA は初回プロンプトで許可）。③ 「音声入力は現在利用できません」→ `GROQ_API_KEY` が未設定。④ 文字起こしは GROQ Whisper を使うため**ネットワーク接続が必要**です（オフラインでは使えません）。

**ダークモードが適用されない**
→ 設定画面の「外観」が「自動」なら OS のカラースキームに追従します（iPhone は **設定 → 画面表示と明るさ**）。「ライト」「ダーク」を選ぶと OS 設定より優先されます。

---

## 今後の実装予定

- [ ] **通知の時刻指定配信** — 現在は毎日 21 時ごろの一斉配信（Vercel Hobby の cron は 1 日 1 回のため）。`notification_time` 列は保存済みなので、毎時 cron（Pro）にすればユーザー別時刻に対応できる
- [ ] **AI ルートのレート制限・利用規約/プライバシーポリシーページ** — 自分以外のユーザーに公開する場合の前提条件
- [ ] **一年のふりかえり（Wrapped 風の年次サマリー）** — 週次レポートの延長線上に、年1回の統計＋シェア向けカード
- [ ] **ストリークの「フリーズ」** — 月に数回まで連続記録を止めずに休める猶予機能

> ✅ **実装済み**（旧・実装予定から移動）: プッシュ通知（Web Push + Vercel Cron）、カレンダー予定の自動挿入、データエクスポート（JSON / CSV）、日記の削除、過去日付の記録（書き忘れ救済）、日記検索・ページング、価値観分析（内省回答の活用）、AI への質問、フラッシュバック、90 日気分ヒートマップ、月めくりカレンダービュー、テーマ手動切り替え（ライト/ダーク/自動）、日記の画像シェア、AI 内省ガイド、音声入力（GROQ Whisper）、Notion 自動同期、週次レポート。
