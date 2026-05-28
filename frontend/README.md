# frontend — Next.js (App Router)

ねじメッキ工程 不具合登録・AI原因分析システムのフロントエンド。
スマホ表示対応・青/グレー/白基調の業務アプリ風UI。

## 技術

- Next.js 14（App Router）/ TypeScript
- Tailwind CSS / Recharts / lucide-react

## セットアップと起動

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000（開発サーバ・ホットリロード）
```

バックエンド（http://localhost:8000）が起動している必要があります。
本デモは開発モード固定です（本番ビルド `next build` / `next start` は使いません）。

## 環境変数

| 変数 | 既定値 | 説明 |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000` | ブラウザから呼ぶAPIのURL（ビルド時に埋め込み） |

別マシンのAPIを使う場合は `frontend/.env.local` に設定:

```
NEXT_PUBLIC_API_BASE_URL=http://192.168.0.10:8000
```

## 画面構成

| パス | 役割 |
| --- | --- |
| `/` | トップ（概要・処理の流れ・サンプルロット） |
| `/defects/new?lot_id=...` | 不具合登録（QR読み取り後） |
| `/defects/[defectId]` | 不具合詳細 |
| `/analysis/[defectId]` | AI原因分析（候補ランキング・確認結果入力） |
| `/reports/[defectId]` | 報告書下書き・承認 |
| `/dashboard` | ダッシュボード（Recharts） |
| `/knowledge` | 承認済みナレッジ一覧（フィルタ） |

## ディレクトリ

```
app/            ルーティング（各page.tsx）
components/     共通・業務UIコンポーネント
lib/            api.ts（APIクライア）/ types.ts（型）/ utils.ts（定数・色）
```
