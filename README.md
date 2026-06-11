# Inner Mirror 🪞

iPhone のホーム画面から使える AI 日記アプリ（PWA）。気分とエネルギーをタップするだけで、AI が日記を自動生成します。記録は Supabase に保存され、Notion にも自動同期できます。

---

## できること

- **30 秒チェックイン** — 気分・エネルギーを選ぶだけで記録完了（テキスト・音声入力も可）
- **AI 日記生成** — チェックイン内容から日記文・タグ・感情を自動生成（Llama 3.3 / GROQ）
- **AI 書き直し** — 「感情豊かに」「短くして」などワンタップで文体変更
- **Notion 自動同期** — 保存と同時に Notion データベースへ書き出し
- **インサイト分析** — 過去の記録から傾向・パーソナリティ・感情トリガーを AI 分析
- **週次レポート** — 直近 7 日間の振り返りナラティブを生成
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
| AI | GROQ API（Llama 3.3 70B / Llama 3.1 8B） |
| 外部同期 | Notion API / Google Calendar API |
| 状態管理 | Zustand |
| スタイリング | Tailwind CSS |
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
 │  │  POST /api/generate-draft    │───┼──→  GROQ API（日記生成）
 │  │  POST /api/rewrite-draft     │───┼──→  GROQ API（書き直し）
 │  │  POST /api/analyze           │───┼──→  GROQ API（パーソナリティ分析）
 │  │  POST /api/weekly-report     │───┼──→  GROQ API（週次レポート）
 │  │  POST /api/notion-sync       │───┼──→  Notion API
 │  │  GET  /api/calendar/today    │───┼──→  Google Calendar API
 │  │  GET/POST /api/settings      │   │  ← 設定の読み書き（トークン暗号化）
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

6 ステップで 30 秒〜1 分。**必須は気分とエネルギーのみ**で、残りはスキップ可能。

| # | 内容 | 必須 |
|---|------|:----:|
| 1 | 気分（5 段階絵文字） | ✅ |
| 2 | エネルギー（5 段階バー） | ✅ |
| 3 | 今日の出来事（テキスト / 音声） | — |
| 4 | 困ったこと | — |
| 5 | 感謝できること | — |
| 6 | 自由記述 | — |

入力内容は localStorage に自動保存されるため、途中でアプリを閉じても続きから再開できます。

---

## データフロー

```
1. チェックイン入力
   └── Zustand store + localStorage に保存

2. "AI に日記を書いてもらう"
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

# GROQ（必須 — AI 日記生成・書き直し・分析・週次レポート）
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

## Vercel へのデプロイ

```bash
npm i -g vercel
vercel
```

または GitHub リポジトリを Vercel に連携すると、push のたびに自動デプロイされます。

### デプロイ後の追加設定（3 つ）

**1. 環境変数を登録**

Vercel → **Settings → Environment Variables** に `.env.local` の内容をそのまま登録。

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

## 環境変数なしでの動作

| 機能 | 環境変数なし | 環境変数あり |
|------|:----------:|:----------:|
| チェックイン入力 | ✅ | ✅ |
| AI 日記生成 | テンプレート生成 | GROQ API |
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

---

## ファイル構成

```
├── app/
│   ├── page.tsx                 # ホーム（統計・チャート）
│   ├── checkin/page.tsx         # 6 ステップ チェックイン
│   ├── draft/page.tsx           # AI ドラフト確認・編集・保存
│   ├── entries/page.tsx         # 日記一覧
│   ├── entries/[date]/page.tsx  # 日記詳細
│   ├── insights/page.tsx        # AI 分析・週次レポート
│   ├── settings/page.tsx        # 設定（Notion・通知・アカウント）
│   ├── login/page.tsx           # ログイン
│   ├── auth/callback/route.ts   # OAuth コールバック（Google トークン保存）
│   └── api/
│       ├── generate-draft/      # AI 日記生成（GROQ）
│       ├── rewrite-draft/       # AI 書き直し（GROQ）
│       ├── analyze/             # パーソナリティ分析（GROQ）
│       ├── weekly-report/       # 週次レポート（GROQ）
│       ├── notion-sync/         # Notion 同期
│       ├── calendar/today/      # Google Calendar 取得
│       └── settings/            # 設定の読み書き（トークン暗号化）
├── components/
│   ├── checkin/                 # MoodStep / EnergyStep / TextStep
│   ├── home/                    # StatsCards / MoodChart / WeekStrip ほか
│   ├── insights/                # PersonalityCard
│   └── ui/                      # BottomNav / VoiceInputButton ほか
├── lib/
│   ├── groq.ts                  # GROQ クライアント・モデル定義
│   ├── crypto.ts                # シークレット暗号化（AES-256-GCM）
│   ├── supabase.ts              # クライアント用 Supabase
│   ├── supabase-server.ts       # サーバー用 Supabase
│   ├── api-client.ts            # fetch ラッパー（タイムアウト・リトライ）
│   └── offline-draft.ts         # オフライン日記生成テンプレート
├── stores/
│   ├── checkin.ts               # チェックイン状態（localStorage 永続化）
│   └── settings.ts              # 端末ローカル設定のみ（サーバー設定は /api/settings）
├── middleware.ts                 # 認証ガード（ページ→リダイレクト / API→401）
├── supabase/migrations/          # 001_init.sql / 002_google_refresh_token.sql
└── public/
    ├── manifest.json            # PWA マニフェスト
    └── sw.js                    # Service Worker（静的アセットキャッシュ）
```

---

## トラブルシューティング

**ログイン後に `/auth/callback` でエラーになる**
→ Supabase **Authentication → URL Configuration → Redirect URLs** にローカル / 本番の URL が登録されているか確認。

**AI 日記生成がテンプレートになる**
→ `GROQ_API_KEY` が正しく設定されているか確認。Vercel の場合は環境変数を登録後に **Redeploy** が必要。

**Notion 同期されない（`notion_page_id` が null のまま）**
→ 設定画面または `.env.local` で Notion トークンと DB ID が設定されているか確認。Notion DB にインテグレーションが接続されているかも確認（DB の **...** → **接続先を追加**）。

**カレンダーの予定が取得できない**
→ 一度サインアウトして **Google で再ログイン**してください（カレンダー権限の同意とトークン保存はログイン時に行われます）。Google Cloud Console で Calendar API が有効か、`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` が設定されているかも確認。

**iPhone で音声入力が動かない**
→ Web Speech API は iOS Safari でのみ動作します。タップ操作を起点に起動する必要があります。

**ダークモードが適用されない**
→ OS のカラースキーム設定に自動追従します。iPhone の **設定 → 画面表示と明るさ** で切り替えてください。

---

## 今後の実装予定

- [ ] プッシュ通知（Web Push API）
- [ ] チェックイン時に当日のカレンダー予定を自動挿入する UI
- [ ] 気分ヒートマップ（カレンダービュー）
- [ ] データエクスポート（JSON / CSV）
- [ ] 日記エントリーの削除機能
- [ ] テーマ手動切り替え（ライト / ダーク / システム）
