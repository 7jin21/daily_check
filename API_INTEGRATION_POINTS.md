# API連携で手を加えるべき場所（実装ポイント）

- `diary-app.jsx` の `generateDraftWithAPI`:
  - 現在は `window.__INNER_MIRROR_API_KEY__` 前提。
  - 本番では **サーバー経由** (`/api/generate-draft`) に置換する。

- `diary-app.jsx` の `generateInsights`:
  - 現在は `buildInsightsOffline` を直接使用。
  - 本番では `/api/analyze` へPOSTし、直近20件を送ってAI分析結果を取得する。

- `diary-app.jsx` の `saveToday`:
  - 保存成功後に Notion 同期API (`/api/notion-sync`) を非同期で呼ぶ。
  - 設定 `notionAutoSync` を見てON/OFF分岐する。

- `diary-app.jsx` のチェックイン開始時:
  - GCal自動取得ONの場合 `/api/calendar/today` を呼び、events初期値へ挿入する。

- `diary-app.jsx` 全体の `fetch` 呼び出し:
  - 共通ラッパー（タイムアウト/リトライ/HTTPエラー整形）を `lib/api.ts` 等へ分離する。

- 認証まわり:
  - OAuth/OIDCログイン後のアクセストークン管理を導入し、
    APIリクエスト時にセッションベースで認可を行う。
