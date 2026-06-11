# AI日記アプリ「Inner Mirror」設計書

> **バージョン**: v2.0
> **最終更新**: 2026-03-29
> **目的**: バイブコーディング用リファレンス。AIコーディングアシスタント（Claude Code, Cursor等）にこのドキュメントを渡して機能開発・拡張を行う。
>
> ⚠️ **注意（2026-06-11 追記）**: 本書の AI プロバイダは設計時点の Anthropic API 前提で書かれていますが、
> **実装は GROQ API（Llama 3.3 / 3.1）に統一済み**です。環境変数は `ANTHROPIC_API_KEY` ではなく `GROQ_API_KEY` を使用します。
> 最新のセットアップ手順・API 一覧は README.md を参照してください。

---

## 0. v2.0 変更サマリー（v1.0 からの差分）

| 項目 | v1.0 | v2.0 |
|------|------|------|
| 動作環境 | PC ブラウザ想定 | **iPhone PWA 主軸** |
| ストレージ | `window.storage`（端末ローカル） | **Supabase（クラウド永続化）** |
| API呼び出し | クライアント直呼び出し（APIキー露出） | **BFF経由（Next.js API Routes）** |
| 認証 | なし | **Apple Sign In / Google OAuth** |
| 外部同期 | 未実装 | **Notion 自動同期（デフォルトON）** |
| ホスティング | ローカル Vite | **Vercel** |
| フレームワーク | React SPA (Vite) | **Next.js 15 (App Router)** |

---

## 1. プロダクト概要

### 1.1 コンセプト

「Inner Mirror」は、毎日の簡単な質問応答からAIが日記を自動生成し、蓄積されたデータからユーザーの性格・思考・感情パターンを可視化する「自己理解のためのAI日記プラットフォーム」。

### 1.2 コアバリュー

- **入力負荷の最小化**: 選択式＋音声入力で30秒〜1分で完了
- **AI文章生成**: 断片的な入力からプロフェッショナルな日記を自動ドラフト
- **自己理解の深化**: 蓄積データからパーソナリティ・思考パターン・感情傾向を分析
- **外部連携**: Notion へ自動保存し、Google Calendar との統合も可能

### 1.3 ターゲットユーザー

- iPhone を日常的に使うビジネスパーソン
- 日記を書きたいが時間がない人
- 自分の振り返りを Notion 等で一元管理したい人

### 1.4 ユーザー動線（主要シナリオ）

```
[初回]
iPhone Safari → サイトへアクセス
  → "ホーム画面に追加" を促すバナー表示
  → Apple Sign In でアカウント作成
  → チュートリアル（スキップ可）

[毎日]
ホーム画面の Inner Mirror アイコンをタップ
  → プッシュ通知 or 習慣から起動（21:00 リマインダー）
  → チェックイン（30秒〜1分、6ステップ）
  → AI が日記ドラフト生成（BFF → Anthropic API）
  → 確認・編集 → 保存
  → Supabase に保存 ＋ Notion へ自動同期（バックグラウンド）

[週次]
  → ホームの気分推移グラフで傾向確認
  → 週次サマリーを Notion のデータベースで閲覧
```

---

## 2. アーキテクチャ

### 2.1 システム構成図

```
┌─────────────────────────────────────────────┐
│  iPhone (PWA / Safari)                       │
│  ┌──────────┐ ┌──────────┐ ┌─────────────┐  │
│  │Check-in  │ │AI Draft  │ │Entries /    │  │
│  │Flow      │ │Editor    │ │Insights     │  │
│  └────┬─────┘ └────┬─────┘ └──────┬──────┘  │
└───────┼────────────┼──────────────┼──────────┘
        │  HTTPS     │              │
┌───────▼────────────▼──────────────▼──────────┐
│  Next.js 15 on Vercel (BFF + Frontend)        │
│  ┌──────────────────────────────────────────┐ │
│  │  App Router (React Server Components)    │ │
│  └───────────────────┬──────────────────────┘ │
│  ┌────────────────────▼─────────────────────┐ │
│  │  API Routes (Route Handlers)             │ │
│  │  POST /api/generate-draft                │ │
│  │  POST /api/analyze                       │ │
│  │  POST /api/notion-sync                   │ │
│  │  GET  /api/calendar/today                │ │
│  └──┬──────────────┬──────────────┬─────────┘ │
└─────┼──────────────┼──────────────┼────────────┘
      │              │              │
      ▼              ▼              ▼
┌──────────┐  ┌──────────┐  ┌──────────────┐
│Supabase  │  │Anthropic │  │ 外部MCP      │
│(Auth +   │  │API       │  │ - Notion     │
│ Database)│  │(Claude   │  │ - GCal       │
│          │  │ Sonnet 4)│  │              │
└──────────┘  └──────────┘  └──────────────┘
```

### 2.2 技術スタック

| レイヤー | 技術 | 選定理由 |
|---------|------|---------|
| フレームワーク | Next.js 15 (App Router) | BFF・SSR・PWA・API Routes を一元管理 |
| ホスティング | Vercel | Next.js との親和性、無料枠で十分 |
| 認証 | NextAuth.js v5 (Auth.js) | Apple Sign In + Google OAuth、Supabase Adapter |
| データベース | Supabase (PostgreSQL) | RLS でユーザー分離、リアルタイム、無料枠あり |
| AI処理 | Anthropic API (Claude Sonnet 4) | **サーバーサイドのみ**、クライアントへ露出しない |
| 外部同期 | Notion MCP / API | 日記をユーザーの Notion DB に自動保存 |
| カレンダー | Google Calendar MCP | 当日予定をチェックインに自動挿入 |
| スタイリング | Tailwind CSS v4 | モバイルファースト、ダークモード対応 |
| PWA | next-pwa | オフライン対応、ホーム画面追加 |
| 状態管理 | Zustand + React Query | クライアント状態 + サーバー状態を分離 |
| 音声入力 | Web Speech API | `lang: ja-JP`、iOSはSafari対応 |

---

## 3. PWA 要件（iPhone 対応）

### 3.1 `manifest.json` 最低限設定

```json
{
  "name": "Inner Mirror",
  "short_name": "InnerMirror",
  "display": "standalone",
  "start_url": "/",
  "background_color": "#1a1a2e",
  "theme_color": "#1a1a2e",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icon-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

### 3.2 iOS Safari 専用 meta タグ（`app/layout.tsx`）

```tsx
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="Inner Mirror" />
<link rel="apple-touch-icon" href="/icon-192.png" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

### 3.3 "ホーム画面に追加" 促進

- iOS では `beforeinstallprompt` が発火しないため、初回訪問時に手動ガイドバナーを表示
- `localStorage` で「案内済み」フラグを管理し、2回目以降は非表示

### 3.4 オフライン対応

- Service Worker で静的アセットをキャッシュ
- チェックイン入力は `IndexedDB` にバッファリング
- オンライン復帰時に自動的に `/api/generate-draft` へ送信

---

## 4. 認証フロー

### 4.1 Apple Sign In（プライマリ）

```
iPhone ユーザー
  → "Appleでサインイン" ボタン
  → Apple ID 認証
  → NextAuth.js が JWT セッションを発行
  → Supabase の users テーブルに upsert
```

- Apple は初回のみメールアドレスを返す → `users.email` は初回に保存する
- プライバシーリレー（hide my email）は許容する

### 4.2 Google OAuth（セカンダリ）

- Android・PC ユーザー向けにも提供
- 同一メールアドレスで Apple / Google の account linking は将来対応

### 4.3 セッション管理

- JWT 戦略（`strategy: "jwt"`）を採用
- `accessToken` はメモリのみ保持（localStorage / cookie への永続保存は避ける）
- Supabase RLS は `auth.uid()` ベースで、他ユーザーのデータには一切アクセス不可

---

## 5. データモデル（Supabase）

### 5.1 テーブル設計

```sql
-- ユーザー設定
CREATE TABLE user_settings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  language            text DEFAULT 'ja',
  theme               text DEFAULT 'auto',
  voice_input_enabled boolean DEFAULT true,
  calendar_auto_fetch boolean DEFAULT false,
  notion_auto_sync    boolean DEFAULT true,   -- デフォルトON
  notion_database_id  text,
  draft_length        text DEFAULT 'medium',  -- short / medium / long
  reminder_time       time DEFAULT '21:00',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- 日記エントリー（全文）
CREATE TABLE entries (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date             date NOT NULL,
  mood             smallint NOT NULL CHECK (mood BETWEEN 1 AND 5),
  energy           smallint NOT NULL CHECK (energy BETWEEN 1 AND 5),
  input_events     text,
  input_challenges text,
  input_gratitude  text,
  input_freeform   text,
  calendar_events  text[],
  draft            text NOT NULL,
  tags             text[],
  summary          text,
  dominant_emotion text,
  notion_page_id   text,                      -- 同期後に保存
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

-- インサイトキャッシュ
CREATE TABLE insights_cache (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  personality  text,
  thinking     text,
  emotions     text,
  values       text,
  advice       text,
  generated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);
```

### 5.2 Row Level Security (RLS)

```sql
-- entries テーブルの例（全テーブルに同様に適用）
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can manage own entries"
  ON entries FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### 5.3 TypeScript 型定義

```typescript
interface Entry {
  id: string;
  userId: string;
  date: string;               // "2026-03-29"
  mood: 1 | 2 | 3 | 4 | 5;
  energy: 1 | 2 | 3 | 4 | 5;
  inputs: {
    events: string;
    challenges: string;
    gratitude: string;
    freeform: string;
  };
  calendarEvents: string[];
  draft: string;
  tags: string[];
  summary: string;
  dominantEmotion: string;
  notionPageId?: string;
  createdAt: string;
}

interface UserSettings {
  language: "ja" | "en";
  theme: "auto" | "light" | "dark";
  voiceInputEnabled: boolean;
  calendarAutoFetch: boolean;
  notionAutoSync: boolean;
  notionDatabaseId?: string;
  draftLength: "short" | "medium" | "long";
  reminderTime: string;       // "21:00"
}
```

---

## 6. API 仕様（BFF: Next.js Route Handlers）

> **原則**: Anthropic APIキーはサーバー環境変数（`ANTHROPIC_API_KEY`）のみに置き、クライアントには絶対に渡さない。

### 6.1 `POST /api/generate-draft`

**リクエスト**:
```typescript
{
  mood: number;
  energy: number;
  events: string;
  challenges: string;
  gratitude: string;
  freeform: string;
  calendarEvents: string[];
  draftLength: "short" | "medium" | "long";  // 100字 / 300字 / 500字
}
```

**サーバー処理**:
```typescript
// app/api/generate-draft/route.ts
import { auth } from "@/auth";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const client = new Anthropic(); // ANTHROPIC_API_KEY は環境変数から自動取得

  const lengthMap = { short: 100, medium: 300, long: 500 };
  const targetLength = lengthMap[body.draftLength ?? "medium"];

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    system: `あなたはユーザーの日記を代筆するAIです。
以下のルールを守ってください：
- 一人称は「今日」や「私は」で始め、自然な日本語で書く
- ${targetLength}文字前後で書く
- 感情を豊かに表現するが、誇張しない
- 最後に tags（配列）・summary（20文字以内）・dominantEmotion（感情1語）をJSON形式で含める
- 返答形式: {"draft":"...","tags":["..."],"summary":"...","dominantEmotion":"..."}`,
    messages: [{
      role: "user",
      content: `気分:${body.mood}/5\nエネルギー:${body.energy}/5\n出来事:${body.events}\n困ったこと:${body.challenges}\n感謝:${body.gratitude}\nその他:${body.freeform}\nカレンダー:${body.calendarEvents.join(", ")}`,
    }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  try {
    return Response.json(JSON.parse(text.replace(/```json|```/g, "").trim()));
  } catch {
    return Response.json({ error: "Parse error" }, { status: 500 });
  }
}
```

### 6.2 `POST /api/analyze`

- 直近 20 件の `entries` を Supabase から取得（認証ユーザーのみ）
- Anthropic API でパーソナリティ分析
- 結果を `insights_cache` に upsert

### 6.3 `POST /api/notion-sync`

- `entries` の `notion_page_id` が null のものを Notion MCP で同期
- 成功後、`entries.notion_page_id` を更新
- 失敗してもローカル保存には影響しない（非同期・Fire and forget）

### 6.4 `GET /api/calendar/today`

- Google Calendar MCP から当日の予定を取得
- `user_settings.calendar_auto_fetch = true` のユーザーのみ有効

### 6.5 共通仕様

```typescript
// lib/api-client.ts
export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000); // 10秒タイムアウト

  let lastError: Error;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(path, { ...options, signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch (e) {
      lastError = e as Error;
      if (attempt < 2) await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw lastError!;
}
```

---

## 7. 外部連携仕様

### 7.1 Notion 連携（デフォルト有効）

**目的**: ユーザーが日記を自分の Notion ワークスペースで閲覧・管理できる。

**設定フロー**:
1. 設定画面 → "Notion連携を設定" → Notion OAuth
2. 接続後、同期先データベースを選択（または自動作成）
3. `user_settings.notion_database_id` に保存

**同期されるデータ**:

| Notionプロパティ | 型 | Inner Mirror フィールド |
|----------------|-----|----------------------|
| タイトル | title | `summary` |
| 日付 | date | `date` |
| 気分 | select | `mood`（1-5 → 😔😕😐😊😄） |
| エネルギー | number | `energy` |
| タグ | multi_select | `tags` |
| 感情 | select | `dominantEmotion` |
| 本文 | rich_text (body) | `draft` |

**Notion MCP 呼び出し例**:
```typescript
// POST /api/notion-sync 内
const notionPageId = await mcpClient.call("notion", "create_page", {
  parent: { database_id: settings.notionDatabaseId },
  properties: {
    "タイトル": { title: [{ text: { content: entry.summary } }] },
    "日付": { date: { start: entry.date } },
    // ...
  },
  children: [{ object: "block", type: "paragraph", paragraph: { rich_text: [{ text: { content: entry.draft } }] } }],
});
```

### 7.2 Google Calendar 連携（オプション）

- ユーザーが設定でONにした場合のみ
- チェックイン開始時に当日の予定を自動取得し `events` フィールドへ挿入
- 取得するのは当日分のみ（最小権限）

---

## 8. 画面仕様

### 8.1 画面一覧

| 画面ID | 画面名 | パス | 説明 |
|--------|--------|------|------|
| `home` | ホーム | `/` | メインダッシュボード |
| `checkin` | チェックイン | `/checkin` | 6ステップの日次入力フロー |
| `draft` | AIドラフト | `/draft` | AI生成日記の確認・編集 |
| `entries` | 日記一覧 | `/entries` | 過去エントリー一覧 |
| `detail` | 日記詳細 | `/entries/[date]` | 個別エントリー表示 |
| `insights` | インサイト | `/insights` | 分析ダッシュボード |
| `settings` | 設定 | `/settings` | Notion連携・通知設定など |

### 8.2 モバイルUI 共通ルール

- 最小タップターゲット: 44×44px（iOS HIG 準拠）
- フォントサイズ: 最小 16px（iOS Safari ズーム自動発動を防ぐ）
- Safe Area 対応: `padding-bottom: env(safe-area-inset-bottom)` を使用
- ボトムナビゲーション固定（ホーム・一覧・インサイト・設定）

### 8.3 チェックインフロー

6ステップの順序:

| Step | ID | 入力形式 | 必須 | 音声入力 |
|------|-----|---------|------|---------|
| 1 | `mood` | 5段階絵文字選択 | ✅ | — |
| 2 | `energy` | 5段階バー選択 | ✅ | — |
| 3 | `events` | テキスト＋カレンダー自動挿入 | — | ✅ |
| 4 | `challenges` | テキスト | — | ✅ |
| 5 | `gratitude` | テキスト | — | ✅ |
| 6 | `freeform` | テキスト | — | ✅ |

---

## 9. 音声入力仕様

```javascript
// iOS Safari は webkitSpeechRecognition のみ対応
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!SR) {
  // フォールバック: テキスト入力のみ表示
  return;
}
const recognition = new SR();
recognition.lang = "ja-JP";
recognition.continuous = false;      // iOS では continuous: true は不安定なため false 推奨
recognition.interimResults = true;
```

> **iOS の制約**: バックグラウンドでの音声認識は不可。ユーザーのタップ操作を起点に起動すること。

---

## 10. セキュリティ設計

### 10.1 APIキー管理

| キー | 保存場所 | アクセス元 |
|------|---------|-----------|
| `ANTHROPIC_API_KEY` | Vercel 環境変数（サーバー専用） | API Routes のみ |
| `NOTION_CLIENT_SECRET` | Vercel 環境変数 | API Routes のみ |
| `GOOGLE_CLIENT_SECRET` | Vercel 環境変数 | NextAuth.js のみ |
| Supabase Service Role Key | Vercel 環境変数 | API Routes のみ |
| Supabase Anon Key | 公開可 | クライアントサイドの読み取りに限定 |

### 10.2 入力バリデーション

- 各テキストフィールドは 500 文字上限（サーバー側で検証）
- XSS 対策: React の JSX エスケープに依存（`dangerouslySetInnerHTML` は使用禁止）
- Notion 同期時はサニタイズしてから送信

### 10.3 プライバシー

- 日記データはユーザーの Supabase RLS で完全分離
- Anthropic API へ送信するデータには `user_id` を含めない
- Notion 連携はユーザーの明示的な OAuth 同意後のみ有効

---

## 11. ファイル構成（Next.js App Router）

```
inner-mirror/
├── app/
│   ├── layout.tsx              # PWA meta タグ、BottomNav
│   ├── page.tsx                # ホーム
│   ├── checkin/
│   │   └── page.tsx            # チェックインフロー
│   ├── draft/
│   │   └── page.tsx            # AIドラフト確認・編集
│   ├── entries/
│   │   ├── page.tsx            # 日記一覧
│   │   └── [date]/
│   │       └── page.tsx        # 日記詳細
│   ├── insights/
│   │   └── page.tsx            # インサイトダッシュボード
│   ├── settings/
│   │   └── page.tsx            # 設定（Notion連携・通知）
│   └── api/
│       ├── generate-draft/
│       │   └── route.ts        # BFF: Anthropic API呼び出し
│       ├── analyze/
│       │   └── route.ts        # BFF: パーソナリティ分析
│       ├── notion-sync/
│       │   └── route.ts        # BFF: Notion同期
│       └── calendar/
│           └── today/
│               └── route.ts    # BFF: GCal当日予定取得
├── components/
│   ├── checkin/
│   │   ├── MoodStep.tsx
│   │   ├── EnergyStep.tsx
│   │   └── TextStep.tsx
│   ├── home/
│   │   ├── StatsCards.tsx
│   │   └── MoodChart.tsx
│   ├── ui/
│   │   ├── BottomNav.tsx
│   │   ├── AddToHomeScreenBanner.tsx
│   │   └── VoiceInputButton.tsx
│   └── insights/
│       └── PersonalityCard.tsx
├── lib/
│   ├── supabase.ts             # Supabase クライアント
│   ├── api-client.ts           # fetch ラッパー（タイムアウト・リトライ）
│   └── offline-draft.ts        # オフラインフォールバック
├── stores/
│   ├── checkin.ts              # Zustand: チェックイン状態
│   └── settings.ts             # Zustand: 設定キャッシュ
├── auth.ts                     # NextAuth.js 設定
├── public/
│   ├── manifest.json
│   ├── icon-192.png
│   ├── icon-512.png
│   └── icon-maskable.png
└── next.config.ts              # next-pwa 設定
```

---

## 12. 機能ロードマップ

### Phase 1: コア（優先実装）✅→🔨

- [x] 6ステップチェックインフロー
- [x] AI日記ドラフト生成（オフラインフォールバック付き）
- [ ] **Next.js + Vercel へ移行**
- [ ] **Supabase Auth（Apple Sign In）**
- [ ] **Supabase DB への保存**
- [ ] **PWA（ホーム画面追加対応）**

### Phase 2: 外部連携

- [ ] Notion 自動同期（BFF経由）
- [ ] Google Calendar 連携
- [ ] 21:00 プッシュ通知（Web Push API）

### Phase 3: 分析強化

- [ ] 週次・月次レポート
- [ ] 気分ヒートマップ（カレンダービュー）
- [ ] AIパーソナリティ分析（実API連携）

### Phase 4: 拡張

- [ ] Gmail 重要メールサマリー連携
- [ ] データエクスポート（JSON / CSV）
- [ ] 複数端末リアルタイム同期（Supabase Realtime）

---

## 13. 環境変数一覧

```env
# .env.local (ローカル開発) / Vercel 環境変数 (本番)

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...        # 公開可
SUPABASE_SERVICE_ROLE_KEY=eyJ...            # サーバー専用・絶対に公開しない

# NextAuth.js
NEXTAUTH_SECRET=（openssl rand -base64 32）
NEXTAUTH_URL=https://your-app.vercel.app

# Apple Sign In
APPLE_CLIENT_ID=com.example.inner-mirror
APPLE_CLIENT_SECRET=（Apple Developer で生成）

# Google OAuth
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...

# Notion
NOTION_CLIENT_ID=xxxx
NOTION_CLIENT_SECRET=secret_...
```

---

## 14. バイブコーディング用プロンプト集

### 新機能追加テンプレート

```
以下の設計書（inner-mirror-design.md）に基づいて、[機能名] を実装してください。

制約:
- APIキーはサーバーサイド（Route Handler）のみで使用
- Supabase の RLS を通じてユーザーデータを取得
- コンポーネントは components/ に分割
- モバイルファースト（44px タップターゲット厳守）
- オフライン時はローカルで動作し、オンライン時に同期
```

### 具体的な実装指示例

**Notion 同期の実装**:
```
app/api/notion-sync/route.ts を実装してください。
- POST メソッド: { entryId: string } を受け取る
- Supabase から当該 entry を取得（認証ユーザーのもののみ）
- Notion MCP または Notion API で page を作成
- 成功後 entries.notion_page_id を更新
- 失敗しても 200 を返す（日記保存には影響させない）
```

**PWA ホーム追加バナーの実装**:
```
components/ui/AddToHomeScreenBanner.tsx を実装してください。
- iOS Safari かつ standalone でない場合のみ表示
- "ホーム画面に追加" の手順をステップ画像付きで案内
- localStorage "pwa-banner-dismissed" で非表示制御
```

---

## 15. テスト観点

| 観点 | 確認内容 |
|------|---------|
| 認証 | Apple Sign In → セッション発行 → Supabase に upsert されること |
| RLS | 他ユーザーのエントリーが取得できないこと |
| チェックイン | mood/energy 未選択で次へ進めないこと |
| AI生成 | BFF 経由でのみ Anthropic API が呼ばれること（クライアントから直接叩けないこと） |
| Notion 同期 | 同期失敗時も日記は Supabase に保存されること |
| オフライン | 機内モードでチェックイン → 復帰後に同期されること |
| PWA | iPhone Safari で "ホーム画面に追加" → standalone 起動できること |
| セーフエリア | iPhone のノッチ・ホームバー領域が UI と被らないこと |
