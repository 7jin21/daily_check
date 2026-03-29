# Inner Mirror (MVP)

AI日記アプリ **Inner Mirror** のMVP実装です。  
日々のチェックイン入力から日記ドラフトを作成し、保存・閲覧・簡易インサイト確認までをローカルで行えます。

## 構成

- `diary-app.jsx` : メインのReact SPA（single-file）
- `main.jsx` : Reactエントリーポイント
- `index.html` : ルートHTML
- `package.json` : Vite実行設定
- `inner-mirror-design.md` : 設計書
- `API_INTEGRATION_POINTS.md` : API連携の改修ポイント
- `USABILITY_REVIEW.md` : ユーザビリティ確認メモ
- `USER_GUIDE.md` : 利用手順書

## 主な機能（MVP）

- 6ステップのチェックイン
  - mood / energy / events / challenges / gratitude / freeform
- 日記ドラフト生成
  - APIキー設定時: Anthropic API呼び出し
  - 未設定時: オフライン生成へフォールバック
- 日記保存・一覧・詳細表示
- インサイト表示（MVPはオフライン分析）

## セットアップ

```bash
npm install
npm run dev
```

## APIキー（開発用）

MVPでは簡易的に `window.__INNER_MIRROR_API_KEY__` がある場合のみ
`https://api.anthropic.com/v1/messages` を直接呼びます。

> ⚠️ 本番ではクライアント直呼び出しは行わず、必ずサーバー(BFF/API Route)経由にしてください。

## データ保存

- `diary:index`
- `diary:entry:YYYY-MM-DD`

`window.storage` があればそれを使用し、なければメモリ上のフォールバックを使います。

## 今後の優先課題

1. API呼び出しをサーバー経由へ移行（キー秘匿）
2. GCal/Gmail/Notion連携の実装
3. 音声入力（Web Speech API）
4. 週次/月次レポート

## ライセンス

社内検証・プロトタイプ用途。
