# Inner Mirror 🪞

iPhone のホーム画面から使える AI 日記アプリ（PWA）。気分とエネルギーをタップするだけで、AI が日記を自動生成します。記録は Supabase に保存され、Notion にも自動同期できます。

---

## できること

- **30 秒チェックイン** — 気分・エネルギーを選ぶだけで記録完了（**2 画面構成**。テキスト・音声入力に対応）
- **書き忘れ救済** — 昨日〜7 日前までの記録をあとから書ける（`/checkin?date=YYYY-MM-DD`。ホームに昨日が空きの場合の導線あり）
- **毎日のリマインダー（Web Push）** — 記録がまだの日だけ、夜にプッシュ通知。昨日の気分を文面に差し込む（[設定方法](#プッシュ通知リマインダーの設定)）
- **カレンダー自動挿入** — チェックイン画面で当日の Google Calendar 予定をワンタップ挿入
- **音声入力** — テキスト欄を 🎤 で音声入力 → GROQ Whisper が文字起こし。iPhone のホーム画面 PWA でも安定動作（[詳細](#音声入力音声で日記を書く)）
- **AI 日記生成** — チェックイン内容から日記文・タグ・感情を自動生成（GROQ / gpt-oss-120b、日本語が自然）。文章はリアルタイムにストリーミング表示され、過去の日記から文体を学習します
- **AI 内省ガイド** — 日記生成の前に、AI が「足りていない1点」（例: なぜそう感じた？／何を大事にしていた？）を **1問だけ** 3〜4択で提示。タップで選ぶだけで感情の理由・価値観が日記に織り込まれます（スキップ可・[詳細](#ai-内省ガイド入力を深掘りする1問)）
- **AI 書き直し** — 「感情豊かに」「短くして」などワンタップで文体変更
- **Notion 自動同期** — 保存と同時に Notion データベースへ書き出し
- **インサイト分析** — 過去の記録から傾向・パーソナリティ・感情トリガー・**価値観（内省ガイドの回答を素材に）**を AI 分析。曜日×気分・タグ×気分のローカル統計も表示
- **AI に聞いてみる** — 「最近気分がいい日の共通点は？」など、日記データに基づいて AI が 1 問 1 答
- **週次レポート** — 直近 7 日間の振り返りナラティブを生成。**先週の「来週のフォーカス」のふり返り付き**
- **フラッシュバック** — 1 年前・1 ヶ月前の今日の記録をホームに表示
- **検索・ページング** — 日記一覧でキーワード検索（本文・出来事・メモ）
- **データ所有権** — JSON / CSV エクスポート、日記の個別削除
- **オフライン対応** — AI API 未設定でもテンプレート生成で動作

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
| スタイリング | Tailwind CSS ＋ CSS 変数（暖色エディトリアル基調 / トークン一元管理） |
| フォント | Schibsted Grotesk（欧文）＋ Zen Kaku Gothic New（和文） |
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

---

## データフロー

```
1. チェックイン入力
   └── Zustand store + localStorage に保存

2. "AI に日記を書いてもらう"
   └── （生成の前に）POST /api/checkin-question → 足りない1点を1問だけ提示（skip 可）
   └── 回答があれば生成の文脈に追加し、保存時に freeform へ畳む
   └── POST /api/generate-draft → GROQ API
   └── { draft, tags, summary, dominantEmotion } を受け取り編集画面へ
   └── API 未設定・失敗時 → オフラインテンプレートにフォールバック

3. "保存する"
   └── Supabase の diary_entries へ upsert（1 ユーザー 1 日 1 件）
   └── バックグラウンドで POST /api/notion-sync
         └── Notion にページ作成（同期済みならスキップ — 重複作成なし）
         ※ Notion 同期が失敗しても日記の保存には影響しません
```

---

## AI 内省ガイド（入力を深掘りする1問）

日記を「出来事ログ」で終わらせず、**感情の理由・価値観**まで残すための仕組み。チェックイン後・日記生成の前に、AI が入力を読み「足りていない1点」だけを質問します。蓄積すると、将来 AI が「あなたが何を大切にしているか」を読み取る素材になります。

### 仕組み

```
チェックイン入力
   └─ POST /api/checkin-question（gpt-oss-120b / JSON モード）
        ├─ 十分書けている / ほぼ空 / 失敗 → 質問せず通過（skip）
        └─ 足りない1点があれば → 1問＋3〜4択を返す
   └─ ユーザーが選ぶ（＋任意で一言／スキップ可）
   └─ 回答を生成プロンプトに渡して日記を生成
   └─ 保存時に freeform へ畳んで残す（DB 列は増やさない）
```

### 何を聞くか（最も欠けている1点）

- 感情はあるが「なぜそう感じたか」が無い
- 出来事はあるが「どう感じたか」が無い
- 迷い／選択はあるが「何を優先したか」が無い
- 感謝はあるが「その何が嬉しかったか」が無い

### 設計上の約束

- **質問は1問だけ**。選択肢は候補（決めつけない）＋「どれも近くない」を必ず付与。
- **絶対にブロックしない**: 質問生成が失敗・遅延（7 秒）・未ログイン・GROQ 未設定なら、黙って日記生成へ進む。
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
- **GROQ_API_KEY 未設定時**: 音声入力は `503`（「音声入力は現在利用できません」）を返すだけで、アプリ自体は壊れません（日記生成のオフラインフォールバックと同じ思想）

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

- Node.js 18.18 以上（`node -v` で確認）

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
npm run build        # 本番ビルドが通るか（型エラー・lint も同時に検査）
npm run lint         # lint だけ単独で
```

- [ ] `/` を開く → 未ログインなら `/login` にリダイレクトされる
- [ ] Google でサインインできる（→ ログインが弾かれる場合は[トラブルシューティング](#トラブルシューティング)の「Unsupported provider」へ）
- [ ] 初回ログイン直後はオンボーディング画面（3 ステップ説明）が出る

### 2. チェックイン → AI 生成 → 保存

- [ ] 気分・エネルギーをタップすると絵文字がポップする
- [ ] 「AI に日記を書いてもらう」で**文章が 1 文字ずつ流れて表示**される（ストリーミング）
- [ ] 生成後にタグ・サマリーが表示される
- [ ] 「保存する」で紙吹雪が出て保存完了 → 日記詳細が開ける
- [ ] 同じ日にもう一度チェックイン → 保存しても**エラーにならず上書き**される（2 回目保存の確認）

### 3. 一覧・分析・編集

- [ ] ホームに統計・週間ストリップ・ヒートマップ・気分チャートが出る
- [ ] `/entries` に月別で一覧が出る
- [ ] `/insights` で「分析する」→ AI パーソナル分析（5 件以上の記録が必要）
- [ ] 日記詳細で本文を編集して保存できる

### 4. 異常系（壊れないことの確認）

- [ ] `.env.local` の `GROQ_API_KEY` を一時的にコメントアウト → AI 生成が**オフラインテンプレート**になる（クラッシュしない）
- [ ] 存在しない URL（例 `/xxxx`）→ ブランドの「ページが見つかりません」画面が出る

> 💡 Notion 同期は実際の Notion 連携が必要です。設定画面でトークンと DB ID を入れてから保存すると、数秒後に `diary_entries.notion_page_id` が埋まります（Supabase の Table Editor で確認可能）。

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

> ⚠️ **Groq はモデルを頻繁に廃止・改名します。** 以前の既定 `moonshotai/kimi-k2-instruct-0905` は廃止され、指定すると `404` → 毎回オフラインにフォールバックしていました。AI 生成が急にテンプレ調になったら、まず[利用可能モデル一覧](https://console.groq.com/docs/models)に現在の `GROQ_MODEL_QUALITY` が載っているか確認してください。`qwen/qwen3-32b` は reasoning モデルで `<think>` タグが本文に混入し JSON モードも壊れるため非推奨です。

- 最新の利用可能モデルは [console.groq.com/docs/models](https://console.groq.com/docs/models) で確認（モデルは頻繁に入れ替わります）
- **JSON モードのルート（`draft-meta` / `rewrite-draft` / `analyze` / `weekly-report` / `checkin-question`）は `reasoning_effort: 'low'` を必ず付ける**。gpt-oss 系は reasoning が JSON 出力を壊し `400 json_validate_failed` を起こすため（付けないと毎回フォールバック＝タグ/要約が空になる等の劣化）。あわせてプロンプトに「JSON」の語を必ず含める（Groq の JSON モード要件）。モデルを差し替える時もこの2点を維持すること
- **モデル ID を間違えても安全**: 生成はオフラインテンプレートに、JSON 系は各フォールバックに自動で切り替わります（白画面にはならない）

### 見た目（配色・フォント）を変えたい

外観は「**暖色エディトリアル**」基調 — 紙色の背景＋エスプレッソの文字＋テラコッタ／山吹のアクセント、フラットで角丸 3px のカード。配色は **CSS 変数で一元管理**しているので、コンポーネントを触らずトークンだけ変えれば全画面に反映されます。

| 変えたいもの | 触る場所 |
|------|------|
| ページ／カード／文字色・罫線（紙・エスプレッソ・テラコッタ・山吹） | `app/globals.css` の `:root`（ダークは `@media (prefers-color-scheme: dark)` と `.dark`） |
| Tailwind の `primary` / `surface` 階調 | `tailwind.config.ts` |
| 気分・エネルギーの色ランプ（アース系 `#b5654a`→`#6f8a5f`） | `lib/constants.ts` の `MOODS` / `ENERGY` |
| フォント（欧文 Schibsted Grotesk ＋ 和文 Zen Kaku Gothic New） | `app/layout.tsx`（Google Fonts の `link`）＋ `app/globals.css` / `tailwind.config.ts` |
| iOS ステータスバー色（theme-color） | `app/layout.tsx` の `<meta name="theme-color">` |

> ダークモードは OS のカラースキームに自動追従します（暖色エスプレッソ系）。`.dark` クラスによる手動オーバーライドの口は用意済みですが、切り替え UI は未実装です（[今後の実装予定](#今後の実装予定)）。

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
- AI が急にテンプレ調になった/同期されない時は、まずここで該当ルートのエラーを見るのが最短です

### コスト・レート制限

- GROQ には無料枠があり、超えると **429（レート制限）** が返ります → アプリ側はフォールバックするので壊れませんが、生成品質が落ちます
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
npm run build             # 1. 本番と同じビルドが通るか（型・lint も検査）
# 2. 手動テスト（上記チェックリスト）
git add -A
git commit -m "..."
git push origin main      # 3. これがトリガー → Vercel が自動ビルド&本番反映
```

- **`main` への push = 本番デプロイ**。他ブランチに push すると本番に影響しないプレビュー URL が生成される（試運転に便利）
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
| AI 日記生成 | テンプレート生成 | GROQ API |
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
| ユーザーの Notion トークン | `ENCRYPTION_KEY` で AES-256-GCM 暗号化して DB 保存。クライアントには返さない |
| Google リフレッシュトークン | 同上（暗号化して DB 保存） |
| データ分離 | Supabase RLS — DB レベルで「自分の行しか読み書きできない」を強制 |
| セッション | HTTP-only Cookie（JS から読み取り不可） |
| 未認証アクセス | middleware がページは `/login` へリダイレクト、API は 401 JSON を返却 |

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

1 ユーザー・1 日・1 エントリー（`UNIQUE(user_id, entry_date)`）。日付は JST 基準。

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
│   ├── auth/callback/route.ts   # OAuth コールバック（Google トークン保存）
│   └── api/
│       ├── checkin-question/    # 生成前の内省質問（GROQ・JSON・skip可）
│       ├── generate-draft/      # AI 日記生成（GROQ・ストリーミング・文体学習・過去日付）
│       ├── draft-meta/          # タグ・サマリー・感情の抽出（GROQ）
│       ├── rewrite-draft/       # AI 書き直し（GROQ）
│       ├── analyze/             # パーソナリティ分析＋価値観抽出（GROQ）
│       ├── weekly-report/       # 週次レポート＋先週フォーカスのふり返り（GROQ）
│       ├── ask/                 # 日記への 1 問 1 答（GROQ）
│       ├── transcribe/          # 音声文字起こし（GROQ Whisper）
│       ├── notion-sync/         # Notion 同期
│       ├── calendar/today/      # Google Calendar 取得
│       ├── settings/            # 設定の読み書き（トークン暗号化）
│       ├── export/              # JSON / CSV エクスポート
│       ├── push/subscribe/      # Web Push 購読の登録・解除
│       └── cron/reminder/       # リマインダー配信（Vercel Cron から）
├── components/
│   ├── checkin/                 # StateStep / NotesStep / TextStep / ReflectionQuestion
│   ├── entry/                   # EditableContent / DeleteEntryButton
│   ├── home/                    # CheckinCTA / StatsCards / MoodChart / WeekStrip ほか
│   ├── insights/                # PersonalityCard
│   └── ui/                      # BottomNav / VoiceInputButton ほか
├── lib/
│   ├── groq.ts                  # GROQ クライアント・モデル定義
│   ├── crypto.ts                # シークレット暗号化（AES-256-GCM）
│   ├── supabase.ts              # クライアント用 Supabase
│   ├── supabase-server.ts       # サーバー用 Supabase
│   ├── supabase-admin.ts        # Service Role クライアント（cron 専用）
│   ├── push-client.ts           # Web Push 購読ヘルパー（クライアント）
│   ├── api-client.ts            # fetch ラッパー（タイムアウト・リトライ）
│   └── offline-draft.ts         # オフライン日記生成テンプレート
├── stores/
│   ├── checkin.ts               # チェックイン状態（localStorage 永続化・対象日）
│   └── settings.ts              # 端末ローカル設定のみ（サーバー設定は /api/settings）
├── middleware.ts                 # 認証ガード（ページ→リダイレクト / API→401）
├── vercel.json                   # Cron 設定（リマインダー配信）
├── supabase/migrations/          # 001_init / 002_google_refresh_token / 003_push_subscriptions
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

**AI 日記生成がテンプレートになる / 急に品質が落ちた**
→ ① `GROQ_API_KEY` が正しく設定されているか確認（Vercel の場合は環境変数登録後に **Redeploy** が必要）。② Vercel/ターミナルのログに `GROQ ... error` が出ていないか確認。`429` ならレート制限なので[運用・保守のコスト項](#コストレート制限)へ。③ モデル ID が無効だと毎回フォールバックします → `GROQ_MODEL_QUALITY` を見直す。

**日本語が不自然・硬い**
→ モデルを日本語に強いものへ差し替え。既定は `openai/gpt-oss-120b` です（[AI モデルを差し替えたい](#ai-モデルを差し替えたい日本語品質速度コスト調整)を参照）。

**AI 日記生成が毎回テンプレ調になる（要約・本文が AI で出ない）**
→ `GROQ_MODEL_QUALITY` のモデルが Groq で**廃止された**可能性大。指定モデルが存在しないと `404` で毎回オフラインにフォールバックします。[利用可能モデル一覧](https://console.groq.com/docs/models)で現在のモデル ID を確認し、`lib/groq.ts` の既定か環境変数を有効なものに更新してください。

**Notion 同期されない（`notion_page_id` が null のまま）**
→ 設定画面または `.env.local` で Notion トークンと DB ID が設定されているか確認。Notion DB にインテグレーションが接続されているかも確認（DB の **...** → **接続先を追加**）。

**カレンダーの予定が取得できない**
→ 一度サインアウトして **Google で再ログイン**してください（カレンダー権限の同意とトークン保存はログイン時に行われます）。Google Cloud Console で Calendar API が有効か、`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` が設定されているかも確認。

**音声入力（🎤）が動かない・録音できない**
→ ① **HTTPS でアクセスしているか確認**。マイク取得（`getUserMedia`）はセキュアコンテキスト必須で、`http://192.168.x.x`（LAN の生 HTTP）では動きません。本番 `https://...vercel.app` か PC の `localhost` で試してください（詳細は[音声入力](#音声入力音声で日記を書く)）。② 「マイクの使用が許可されていません」→ ブラウザ / OS のマイク権限を確認（iPhone は **設定 → Safari → マイク**、PWA は初回プロンプトで許可）。③ 「音声入力は現在利用できません」→ `GROQ_API_KEY` が未設定。④ 文字起こしは GROQ Whisper を使うため**ネットワーク接続が必要**です（オフラインでは使えません）。

**ダークモードが適用されない**
→ OS のカラースキーム設定に自動追従します。iPhone の **設定 → 画面表示と明るさ** で切り替えてください。

---

## 今後の実装予定

- [ ] **通知の時刻指定配信** — 現在は毎日 21 時ごろの一斉配信（Vercel Hobby の cron は 1 日 1 回のため）。`notification_time` 列は保存済みなので、毎時 cron（Pro）にすればユーザー別時刻に対応できる
- [ ] **気分ヒートマップ（月カレンダービュー）** — 13 週のコントリビューション型ヒートマップはホームに**実装済み**（`components/home/CalendarHeatmap.tsx`）。残るは月めくりのカレンダー表示
- [ ] **テーマ手動切り替え（ライト / ダーク / システム）** — `.dark` クラス＋ `localStorage('inner-mirror-theme')` 読み取りの土台は `app/layout.tsx` にあるが、切り替え UI は未実装（現状は OS のカラースキームに自動追従）
- [ ] **AI ルートのレート制限・利用規約/プライバシーポリシーページ** — 自分以外のユーザーに公開する場合の前提条件

> ✅ **実装済み**（旧・実装予定から移動）: プッシュ通知（Web Push + Vercel Cron）、カレンダー予定の自動挿入、データエクスポート（JSON / CSV）、日記の削除、過去日付の記録（書き忘れ救済）、日記検索・ページング、価値観分析（内省回答の活用）、AI への質問、フラッシュバック、90 日気分ヒートマップ、AI 内省ガイド、音声入力（GROQ Whisper）、Notion 自動同期、週次レポート。
