# AI日記アプリ「Inner Mirror」設計書

> **バージョン**: v1.0  
> **最終更新**: 2026-03-29  
> **目的**: バイブコーディング用リファレンス。AIコーディングアシスタント（Claude Code, Cursor等）にこのドキュメントを渡して機能開発・拡張を行う。

---

## 1. プロダクト概要

### 1.1 コンセプト
「Inner Mirror」は、毎日の簡単な質問応答からAIが日記を自動生成し、蓄積されたデータからユーザーの性格・思考・感情パターンを可視化する「自己理解のためのAI日記プラットフォーム」。

### 1.2 コアバリュー
- **入力負荷の最小化**: 選択式＋音声入力で30秒〜1分で完了
- **AI文章生成**: 断片的な入力からプロフェッショナルな日記を自動ドラフト
- **自己理解の深化**: 蓄積データからパーソナリティ・思考パターン・感情傾向を分析
- **外部連携**: Google Calendar / Gmail / Notionとのシームレスな統合

### 1.3 ターゲットユーザー
- 忙しいビジネスパーソンで日記を書きたいが時間がない人
- 自己理解・内省を深めたい人
- データドリブンに自分の傾向を把握したい人

---

## 2. アーキテクチャ

### 2.1 システム構成図

```
┌─────────────────────────────────────────────────────┐
│  Frontend (React SPA)                                │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌───────────┐ │
│  │Check-in  │ │AI Draft  │ │Entries │ │Insights   │ │
│  │Flow      │ │Editor    │ │Browser │ │Dashboard  │ │
│  └────┬─────┘ └────┬─────┘ └───┬────┘ └─────┬─────┘ │
│       │            │           │             │       │
│  ┌────▼────────────▼───────────▼─────────────▼─────┐ │
│  │          State Management (React useState)       │ │
│  └────────────────────┬────────────────────────────┘ │
└───────────────────────┼──────────────────────────────┘
                        │
         ┌──────────────┼──────────────┐
         ▼              ▼              ▼
┌────────────┐  ┌──────────────┐  ┌──────────────┐
│ Persistent │  │ Anthropic    │  │ MCP Servers  │
│ Storage    │  │ API          │  │              │
│ (window.   │  │ (Claude      │  │ - GCal       │
│  storage)  │  │  Sonnet 4)   │  │ - Gmail      │
│            │  │              │  │ - Notion     │
└────────────┘  └──────────────┘  └──────────────┘
```

### 2.2 技術スタック

| レイヤー | 技術 | 備考 |
|---------|------|------|
| フロントエンド | React (JSX artifact) | Single-file component |
| チャート | Recharts | AreaChart, LineChart |
| AI処理 | Anthropic API (Claude Sonnet 4) | `/v1/messages` エンドポイント |
| データ永続化 | `window.storage` API | Key-Value、5MB/key上限 |
| 音声入力 | Web Speech API | `SpeechRecognition`, `lang: ja-JP` |
| 外部連携 | MCP (Model Context Protocol) | Google Calendar, Gmail, Notion |
| スタイリング | Inline styles + CSS variables | ダークモード自動対応 |

### 2.3 将来のスタック拡張候補

フル版に移行する場合の推奨スタック:

| レイヤー | 技術 | 理由 |
|---------|------|------|
| フレームワーク | Next.js 15 (App Router) | SSR/SSG、API Routes、認証統合 |
| 認証 | NextAuth.js / Clerk | Google OAuth連携 |
| DB | Supabase (PostgreSQL) | RLS、リアルタイム、無料枠 |
| ORM | Prisma / Drizzle | 型安全なDB操作 |
| ホスティング | Vercel | Next.jsとの親和性 |
| 状態管理 | Zustand | 軽量、永続化プラグイン |

---

## 3. データモデル

### 3.1 ストレージキー設計

```
diary:index           → EntryIndex[]     （全エントリーのサマリー配列）
diary:entry:{date}    → Entry            （個別エントリー、dateは YYYY-MM-DD）
diary:insights        → InsightsCache    （キャッシュされたインサイト分析結果）
diary:settings        → UserSettings     （ユーザー設定）
diary:profile         → UserProfile      （蓄積されたプロフィールデータ）
```

### 3.2 型定義

```typescript
// === エントリー関連 ===

interface Entry {
  date: string;              // "2026-03-29" (YYYY-MM-DD)
  timestamp: number;         // Unix timestamp (ms)
  mood: number;              // 1-5
  energy: number;            // 1-5
  inputs: {
    events: string;          // ユーザーの生入力
    challenges: string;
    gratitude: string;
    freeform: string;
  };
  calendarEvents: string[];  // Google Calendar取得データ
  draft: string;             // AI生成 or ユーザー編集後の日記本文
  tags: string[];            // AI抽出タグ ["仕事", "達成感", "チームワーク"]
  summary: string;           // AI生成の一行要約（20文字以内）
  dominantEmotion: string;   // AI判定の主要感情 "充実感"
}

interface EntryIndex {
  date: string;
  mood: number;
  energy: number;
  summary: string;
  tags: string[];
  dominantEmotion: string;
}

// === インサイト関連 ===

interface PersonalityInsights {
  personality: string;       // 性格特性の分析
  thinking: string;          // 思考パターンの傾向
  emotions: string;          // 感情の傾向と特徴
  values: string;            // 大切にしている価値観
  advice: string;            // アドバイス
  generatedAt: number;       // 生成日時
}

// === ユーザー設定 ===

interface UserSettings {
  language: "ja" | "en";
  theme: "auto" | "light" | "dark";
  voiceInputEnabled: boolean;
  calendarAutoFetch: boolean;
  notionAutoSync: boolean;
  notionDatabaseId?: string;
  draftLength: "short" | "medium" | "long";  // 100字 / 300字 / 500字
  reminderTime?: string;     // "21:00" 通知時刻
}

// === 長期プロフィール ===

interface UserProfile {
  totalEntries: number;
  firstEntryDate: string;
  longestStreak: number;
  moodDistribution: Record<number, number>;   // {1: 3, 2: 5, 3: 12, ...}
  topTags: Array<{tag: string; count: number}>;
  monthlyMoodAvg: Array<{month: string; avg: number}>;
  personalityEvolution: Array<{
    date: string;
    analysis: PersonalityInsights;
  }>;
}
```

### 3.3 ストレージ容量見積もり

| データ | 1件あたり | 1年分 | 備考 |
|--------|----------|-------|------|
| Entry | ~1-2 KB | ~500 KB | 日記本文300-500文字想定 |
| EntryIndex | ~200 B | ~73 KB | サマリーのみ |
| Insights | ~2 KB | ~24 KB | 月1回再生成想定 |
| **合計** | | **~600 KB** | 5MB上限に対して余裕あり |

---

## 4. 画面仕様

### 4.1 画面一覧

| 画面ID | 画面名 | パス (将来) | 説明 |
|--------|--------|------------|------|
| `home` | ホーム | `/` | メインダッシュボード |
| `checkin` | チェックイン | `/checkin` | 6ステップの日次入力フロー |
| `draft` | AIドラフト | `/draft` | AI生成日記の確認・編集 |
| `entries` | 日記一覧 | `/entries` | 過去エントリー一覧 |
| `detail` | 日記詳細 | `/entries/:date` | 個別エントリー表示 |
| `insights` | インサイト | `/insights` | 分析ダッシュボード |
| `settings` | 設定 | `/settings` | ユーザー設定（未実装） |

### 4.2 ホーム画面

```
┌─────────────────────────────────┐
│ 3月29日（土）                    │
│                                 │
│ おつかれさまでした               │  ← 時間帯で変化
│ 今日一日を振り返りましょう       │
│                                 │
│ ┌─────┐ ┌─────┐ ┌─────┐       │
│ │ 5日 │ │ 23件│ │ 3.8 │       │  ← 統計カード
│ │連続 │ │総数 │ │平均 │       │
│ └─────┘ └─────┘ └─────┘       │
│                                 │
│ ┌─────────────────────────────┐ │
│ │  [今日の日記を書く]          │ │  ← メインCTA
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │  気分 & エネルギー推移       │ │  ← AreaChart (14日分)
│ │  📈 ~~~~~~~~                │ │
│ └─────────────────────────────┘ │
│                                 │
│ 最近の記録                      │
│ ┌─ 😊 3/28（金） いい一日 ──┐  │
│ ┌─ 😐 3/27（木） まあまあ ──┐  │
│ ┌─ 😄 3/26（水） 最高の日 ──┐  │
│                                 │
│ ◉ホーム  ☰日記一覧  ◈インサイト │  ← ボトムナビ
└─────────────────────────────────┘
```

### 4.3 チェックインフロー

6ステップの順序:

| Step | ID | 入力形式 | 必須 | 音声入力 |
|------|-----|---------|------|---------|
| 1 | `mood` | 5段階絵文字選択 | ✅ | — |
| 2 | `energy` | 5段階バー選択 | ✅ | — |
| 3 | `events` | テキスト＋カレンダー取得 | — | ✅ |
| 4 | `challenges` | テキスト | — | ✅ |
| 5 | `gratitude` | テキスト | — | ✅ |
| 6 | `freeform` | テキスト | — | ✅ |

### 4.4 AIドラフト画面

```
┌─────────────────────────────────┐
│ ← 入力に戻る                   │
│                                 │
│ AIが書いた日記                  │
│ 編集して保存できます            │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 😊 3月29日（土）  [充実感]  │ │
│ │                             │ │
│ │ 今日は朝からチームMTGが     │ │
│ │ あり、プロジェクトの進捗     │ │
│ │ を共有した。メンバーから     │ │
│ │ ポジティブなフィードバック   │ │
│ │ をもらえて嬉しかった...      │ │
│ │                             │ │
│ │ #仕事 #達成感 #チーム       │ │
│ └─────────────────────────────┘ │
│                                 │
│ [  編集する  ]  [  再生成  ]   │
│ [        保存する          ]   │
└─────────────────────────────────┘
```

### 4.5 インサイト画面

```
┌─────────────────────────────────┐
│ インサイト                      │
│ AIが日記から読み取る傾向        │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 気分 & エネルギー推移        │ │
│ │ 📈 ~~~~~~~~ (14日)          │ │
│ └─────────────────────────────┘ │
│                                 │
│ [AIにパーソナリティを分析して   │
│  もらう]                        │
│                                 │
│ ┌ 🧠 性格特性 ───────────────┐ │
│ │ 責任感が強く、チームへの     │ │
│ │ 貢献を重視する傾向が...      │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

---

## 5. API仕様

### 5.1 日記ドラフト生成

**エンドポイント**: `POST https://api.anthropic.com/v1/messages`

**リクエスト**:
```json
{
  "model": "claude-sonnet-4-20250514",
  "max_tokens": 1000,
  "messages": [{
    "role": "user",
    "content": "（下記システムプロンプト参照）"
  }]
}
```

### 5.2 パーソナリティ分析

**トリガー条件**: エントリー数 >= 3

### 5.3 Google Calendar連携

**MCP Server**: `https://gcal.mcp.claude.com/mcp`

### 5.4 Gmail連携（未実装）

**MCP Server**: `https://gmail.mcp.claude.com/mcp`

### 5.5 Notion連携（未実装）

**MCP Server**: `https://mcp.notion.com/mcp`

---

## 6. 音声入力仕様

### 6.1 Web Speech API設定

```javascript
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SR();
recognition.lang = "ja-JP";
recognition.continuous = true;
recognition.interimResults = true;
```

---

## 7. デザインシステム

### 7.1 カラーパレット

```css
--color-text-primary
--color-text-secondary
--color-text-tertiary
--color-background-primary
--color-background-secondary
--color-border-tertiary
```

---

## 8. 機能ロードマップ

### Phase 1: MVP（現在）✅
- [x] 6ステップチェックインフロー
- [x] AI日記ドラフト生成
- [x] 永続化
- [x] インサイト分析

### Phase 2〜4
- [ ] 週次・月次レポート
- [ ] Gmail/Notion連携
- [ ] 検索・ヒートマップ
- [ ] PWA化・同期・エクスポート

---

## 9. ファイル構成（フル版移行時）

- `app/`, `components/`, `lib/`, `stores/`, `prisma/`, `public/`

---

## 10. バイブコーディング用プロンプト集

新機能追加テンプレートと具体例（週次レポート/カレンダーヒートマップ/Notion同期）を用意。

---

## 11. テスト観点

気分・エネルギー選択、音声入力、AI生成、保存、一覧表示、分析、ストリーク、エッジケースを網羅。

---

## 付録: 定数定義

```javascript
const STEPS = ["mood", "energy", "events", "challenges", "gratitude", "freeform"];
```

---

## 12. 外部接続要件（追加）

この設計書は**バイブコーディングでWebアプリを実装するための実装基準**として利用する。

### 12.1 接続方式
- 配信形態は HTTPS 前提（本番では TLS 1.2+）
- CORS はフロントエンド配信ドメインのみ許可（開発環境は localhost を追加）
- API 通信は `fetch` + JSON で統一し、`Content-Type: application/json` を必須
- 外部API呼び出しは 10 秒タイムアウト + リトライ（最大2回）

### 12.2 認証・認可
- 将来の外部公開に向け、ユーザー単位の認証導入を前提化（OAuth 2.0 / OIDC を推奨）
- アクセストークンはメモリ保持を基本にし、永続保存は避ける
- API キーはクライアントに直書きせず、サーバー経由で取り扱う

### 12.3 外部連携先ごとの要件
- Anthropic API: サーバーサイドから代理呼び出しし、秘密情報を秘匿
- Google Calendar MCP: ユーザー同意後に当日予定のみ取得（最小権限）
- Gmail MCP: 重要メール要約のみ取得、本文全文保存はしない
- Notion MCP: 同期 ON/OFF を設定で切り替え可能にする

### 12.4 セキュリティ・監査
- 監査ログ: 「いつ」「どの連携先へ」「成功/失敗」を記録
- PII を含む本文はマスキング設定を提供（将来機能）
- レート制限に備え、連携失敗時は UI 上で再試行可能にする

### 12.5 運用要件
- 外部接続が失敗しても、日記のローカル保存は継続可能にする（オフラインファースト）
- 連携機能の状態（未接続/接続済み/エラー）を設定画面に明示
- 接続先追加時は「目的・取得データ・保存期間」を仕様に追記する
