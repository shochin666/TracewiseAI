# TraceWise-AI — ねじメッキ工程 不具合登録・AI原因分析システム（デモ）

QRコードでロットを特定し、工程データから**原因候補**と**報告書下書き**を自動生成する、製造業向けデモシステムです。
題材は**ねじの亜鉛メッキ工程**。本番のLLM連携は使わず、**工程知識・管理基準・FMEA風ルール＋スコアリング**で動作します。

> **重要ポリシー**
> AIは真因を**断定しません**。AIは**原因候補と確認項目**を提示し、**最終原因は品質担当者の承認**で確定します。
> 承認済みの事例だけがナレッジ化され、使うほど原因候補が現場に合った形へ補正されます。

---

## 1. システム概要

従来、現場では「報告書作成が面倒」「原因の自由記述が負担」「データが蓄積されない」という課題がありました。本システムは次の流れでこれを解決します。

1. 通い箱・トレー・バレル札のQRコードをスマホで読み取る
2. QR内URLの `lot_id` をキーに、品番・製品・工程・設備・処理時刻を**自動表示**
3. 現場担当者は**不具合種別・発生数・検査数・暫定対応**など「見た事実」だけを入力
4. システムが工程パラメータ・環境パラメータ・過去事例を**自動紐づけ**
5. AI風ロジックが**原因候補・根拠・確認項目**を提示
6. 現場/品質担当者が確認結果を**選択式**で入力
7. AI風ロジックが**報告書下書き**を生成
8. 品質担当者が**承認**した事例だけを**ナレッジDB**に登録
9. 事例が増えるほど、承認済みナレッジで**原因候補の順位を補正**

## 2. デモの価値

- **入力負担の最小化**：現場は原因を考えず「事実」だけ入力。原因推定はシステムが担う。
- **データの自動紐づけ**：lot_id をキーに工程・環境パラメータを自動取得し、異常値を強調表示。
- **断定しないAI**：原因候補＋根拠＋確認項目を提示。確認結果と承認で確定するため、現場の納得感が高い。
- **ナレッジが効く設計**：初期は工程知識・管理基準で候補提示し、承認事例が増えるほど候補順位がその現場向けに補正される。

## 3. アーキテクチャ

```
┌─────────────┐   HTTP(JSON)   ┌──────────────┐
│  Next.js     │ ───────────▶  │  FastAPI      │
│ (App Router) │ ◀───────────  │  (Python)     │
│ TypeScript   │   CORS        │  分析エンジン  │
│ Tailwind     │               │  報告書生成    │
│ Recharts     │               └──────┬───────┘
└─────────────┘                       │ sqlite3
                                       ▼
                                 ┌──────────┐
                                 │  SQLite   │  products / lots /
                                 │           │  process_parameters /
                                 └──────────┘  environment_parameters /
                                               defects / investigation_results /
                                               knowledge_cases
QR生成: tools/qr/generate_qr.py（qrcode[pil]）→ lot_id入りURLのQR/ラベルPNG
```

- **フロントエンド**：Next.js 14（App Router）/ TypeScript / Tailwind CSS / Recharts / lucide-react。スマホ対応・青/グレー/白基調。
- **バックエンド**：FastAPI / Python 3.11+ / SQLite（sqlite3直接）/ Pydantic。
- データはブラウザ → FastAPI を直接呼び出し（CORS許可済み）。

```
project-root/
├ README.md                ← このファイル
├ docker-compose.yml
├ .env.example
├ backend/                 FastAPI + SQLite（app/, requirements.txt, Dockerfile, Dockerfile.prod）
├ frontend/                Next.js（app/, components/, lib/, Dockerfile, Dockerfile.prod）
├ infra/                   Azureデプロイ用 Bicep（platform.bicep / apps.bicep）と OIDC設定スクリプト
├ docs/                    DEPLOY.md（Azureデプロイ手順）
├ .github/workflows/       deploy.yml（CI/CD: Azure Container Apps へ自動デプロイ）
└ tools/
   ├ qr/                   QR生成スクリプト・lots.csv・output/（生成済みサンプルPNG）
   └ sample_data/          seed_data.json（投入サンプルデータのエクスポート）
```

## 4. 起動方法

### 方法A：Docker（開発モード・ホットリロード）

```bash
docker compose up            # 通常はこれだけ。コード編集は再ビルドなしで即反映
docker compose up --build    # 初回、または依存(package.json / requirements.txt)を変えた時だけ
# フロント:  http://localhost:3000
# API:      http://localhost:8000  （APIドキュメント: /docs）
```

- ソースをマウントして起動するため、`.py` / `.tsx` を編集すると**再ビルドなしで自動反映**されます（本番ビルドは行いません）。
- 初回起動時、バックエンドが空のDBに**サンプルデータを自動投入**します。
- 依存（`package.json` / `requirements.txt`）を変えた時だけ `--build` を付け直してください。

### 方法B：ローカル起動（2つのターミナル）

**バックエンド**
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m app.seed                 # サンプルデータ投入（任意。起動時にも空なら自動投入）
uvicorn app.main:app --reload --port 8000
```

**フロントエンド**（別ターミナル）
```bash
cd frontend
npm install
npm run dev                        # http://localhost:3000
```

> デモを初期状態へ戻す: `curl -X POST http://localhost:8000/api/admin/reseed`

## 5. QRコード生成方法

```bash
cd tools/qr
pip install "qrcode[pil]"          # 未導入の場合
python generate_qr.py --base-url http://localhost:3000
# 工場スマホから読む場合はPCのLAN IPを指定: --base-url http://192.168.0.10:3000
```

- 入力：`tools/qr/lots.csv`（`lot_id, product_id, product_name, label_title`）
- 出力：`tools/qr/output/{lot_id}_qr.png`（QR）と `{lot_id}_label.png`（ラベル印刷用）
- QRの中身：`http://localhost:3000/defects/new?lot_id=LOT-2026-0527-PM-01`

生成済みのサンプル画像が `tools/qr/output/` にコミットされています。

## 6. サンプルデモ手順（白っぽい変色のシナリオ）

> QRが無くてもOK：トップページの「サンプルロット」または「デモを開始」から実行できます。

1. トップで **「デモを開始」**（= `LOT-2026-0527-PM-01` の登録画面）を開く
   （実機では通い箱ラベルのQRをスマホで読む → `/defects/new?lot_id=LOT-2026-0527-PM-01`）
2. **ロット情報が自動表示**される（六角ボルト M8×25 / 亜鉛メッキ / バレル）
3. 不具合種別 **「白っぽい変色」** を選ぶ
4. 発生数 **48**、検査数 **1000** を入力（不良率 4.8% が自動計算）
5. 暫定対応 **「対象ロット隔離」** を選び **登録**
6. **AI原因分析画面**に遷移。工程パラメータの異常（乾燥炉温度低・水洗導電率高・電流密度低下・湿度高）が強調表示される
7. 原因候補が **乾燥不足（最有力）／水洗不足／電流密度異常** の順で表示される
8. 優先確認項目に対し「乾燥炉実測温度：異常あり」「水洗水導電率：異常あり」「pH：異常なし」等を入力 → **保存**
9. **報告書生成画面**で下書きが自動生成される
10. 確定原因「乾燥不足」を確認して **承認** → 「承認済み事例としてナレッジ化しました（状態: 監視中）」
    （このとき同一品番×同一原因の監視中事例があれば、自動的に「再発あり」へ更新される）
11. **ナレッジ一覧**に承認済み事例が追加される（13 → 14 件）。新規事例は**監視中**で登録され、監視期間（90日）満了後または再発確認時に「再発なし／再発あり」を確定できる
12. **ダッシュボード**で承認済みナレッジ件数・原因別件数などが更新される

## 7. API一覧

| メソッド | パス | 説明 |
| --- | --- | --- |
| GET | `/api/lots/{lot_id}` | ロット情報（製品情報込み） |
| POST | `/api/defects` | 不具合登録 |
| GET | `/api/defects/{defect_id}` | 不具合詳細 |
| GET | `/api/analysis/{defect_id}` | 分析結果（工程紐づけ・原因候補・確認項目） |
| POST | `/api/analysis/{defect_id}/investigation-results` | 確認結果の保存 |
| GET | `/api/reports/{defect_id}` | 報告書下書き |
| POST | `/api/reports/{defect_id}/approve` | 承認しナレッジ登録 |
| GET | `/api/dashboard/summary` | ダッシュボード集計 |
| GET | `/api/environment/live` | 工場環境の現在値（擬似センサー。ダッシュボードのリアルタイム表示用） |
| GET | `/api/knowledge` | 承認済みナレッジ一覧（`product_id`/`defect_type`/`confirmed_cause`/`surface_treatment` で絞り込み。監視状況も付与） |
| PATCH | `/api/knowledge/{case_id}/recurrence` | 再発有無の後日判定（監視中 → 再発なし / 再発あり） |
| GET | `/api/health` | ヘルスチェック |
| POST | `/api/admin/reseed` | サンプルデータ再投入（デモ初期化） |

`GET /api/analysis/{defect_id}` の返却：`defect / lot / product / process_parameters / environment_parameters / quality_trend / similar_cases / excluded_cases / cause_candidates / check_items`。

## 8. データモデル概要

| テーブル | 役割 |
| --- | --- |
| `products` | 製品マスタ（品番・材質・表面処理・処理方式・工程ルート） |
| `lots` | ロット（QRのキー。品番・工程・設備・処理時刻） |
| `process_parameters` | 工程パラメータ（脱脂温度・水洗導電率・電流密度・乾燥温度 等） |
| `environment_parameters` | 環境パラメータ（工場/保管庫の温湿度・露点・保管時間） |
| `defects` | 不具合（種別・発生数・検査数・暫定対応・状態） |
| `investigation_results` | 確認結果（項目ごとに 異常あり/なし/未確認/該当なし） |
| `knowledge_cases` | 承認済みの確定事例（確定原因・有効対策・再発有無 等） |

`defects.status`：`registered → analyzing → investigated → report_generated → approved`

`knowledge_cases.recurrence_status`（対策実施後のライフサイクル）：`監視中 → 再発なし / 再発あり`
- 承認時は必ず**監視中**で登録する（再発有無は対策後の経過観察で判明するため、承認時点では判定しない）。
- **再発あり**：新規承認時に「同一品番 × 同一確定原因」の監視中事例があれば、対策後の再発として**自動検知**し更新（`recurred_lot_id` / `recurrence_ref_case_id` に根拠を記録）。または手動で確定。
- **再発なし**：監視期間（`MONITORING_WINDOW_DAYS`＝90日）満了後に品質担当者が手動で確定する。
- 関連カラム：`action_implemented_at`（監視開始＝承認時刻）、`recurrence_checked_at`（判定日時）、`recurrence_note`。

スキーマ定義は `backend/app/models.py`、投入データは `backend/app/seed.py` / `tools/sample_data/seed_data.json` を参照。

## 9. AI風分析ロジックの説明

実装：`backend/app/analysis_engine.py`（原因候補スコアリング・類似事例補正）と `backend/app/report_generator.py`（報告書生成）。**本物のLLMは使いません。**

### 9.1 原因を断定しない出力ポリシー
「可能性が高い」「優先確認を推奨」「原因候補」「確認結果により確定が必要」といった表現のみを用い、断定を避けます。

### 9.2 原因候補のスコアリング
各原因候補（乾燥不足／水洗不足／電流密度異常／メッキ浴pH変動／脱脂不足）について、以下を加点します。

- **パラメータ異常**（管理基準を逸脱）… +25/件
- **不具合種別の合致**（その原因で出やすい種別か）… +25
- **限界寄り**（管理範囲内だが限界に近い）… +10
- **類似事例の支持**（承認済みナレッジ）… +20 ※現工程に何らかの兆候がある場合のみ加点

スコア順にランキングし、最上位を「最有力候補（優先確認を推奨）」として表示します。

### 9.3 類似事例スコア（ナレッジ補正）
`knowledge_cases` の各事例と今回の不具合の類似度を計算します。

- 同一 品番 +30 / 表面処理 +25 / 不具合種別 +25 / 材質 +15 / 工程 +10

スコアが高い事例を**参考事例**、低い事例（表面処理・材質・工程が異なる等）を**除外/参考度低**として、理由つきで提示します。
（例：「同じ亜鉛メッキ工程のため参考度高」「ステンレス不動態化処理の事例のため参考度低」「黒染め工程の事例のため条件が異なる」）

### 9.4 初期は工程知識、蓄積後はナレッジで補正
- **初期段階**：工程知識・管理基準・FMEA風ルール（パラメータ＋不具合種別）で候補を提示。
- **事例蓄積後**：承認済みナレッジの支持（+20）が加わり、その現場で実際に確定した原因の順位が上がる＝**使うほど現場に合った候補へ補正**されます。
- 承認時（`POST /api/reports/{id}/approve`）に新しい `knowledge_case` が追加され、次回以降の分析に反映されます。
- **再発有無は「対策の信頼度」に反映**：原因スコアは工程異常の軸で算出し、再発有無では変えません（軸を分離）。一方、報告書の恒久対策案は再発状況で出し分けます——**再発なし**＝検証済みの「有効だった対策」として推奨／**監視中**＝「効果は経過観察中」と明示／**再発あり**＝推奨せず「より強い恒久対策が必要」と警告（`report_generator.py`）。

## 10. 動作確認（このリポジトリで検証済み）

- バックエンド：API全エンドポイントを通しで確認（登録→分析→確認結果→報告書→承認でナレッジ 13→14 件、ダッシュボード集計更新）。
- フロントエンド：全7ルートの起動・200応答、CORS 許可を確認。
- QR生成：5ロット分のQR/ラベルPNGを生成（`tools/qr/output/`）。

> 注：**ローカルデモは開発モード固定**です（フロント=`next dev`、バックエンド=`uvicorn --reload`）。
> Azure へのデプロイ時のみ本番ビルド（`frontend/Dockerfile.prod` の Next.js standalone ／ `backend/Dockerfile.prod`）を使います（→ §11）。
> Python は 3.11+ 想定（コードは 3.9 でも動作）、Docker は backend に `python:3.11-slim` を使用。

## 11. Azure へのデプロイ（CI/CD・任意）

`main` への push で **GitHub Actions → Azure Container Apps** に自動デプロイできます（手動実行も可）。

- **構成**：frontend(公開) / backend(非公開) の2コンテナ＝**Azure Container Apps**、画像は **Azure Container Registry**、SQLite は **Azure Files** に永続化。マネージドサービス中心・低コスト（無アクセス時は 0 スケール）。
- **接続**：ブラウザは frontend だけを叩き、`/api/*` は Next.js が backend(内部)へプロキシ（CORS不要・backend非公開）。
- **認証**：GitHub→Azure は **OIDC**（シークレットレス）。
- **イメージ**：`backend/Dockerfile.prod` / `frontend/Dockerfile.prod`（Next.js standalone）。
- **IaC**：`infra/platform.bicep`（基盤）/ `infra/apps.bicep`（アプリ）。
- **パイプライン**：`.github/workflows/deploy.yml`。

### 最初の1回だけ
```bash
az login
bash infra/setup-azure-oidc.sh        # OIDC設定＋GitHub Secrets に必要な値を出力
```
出力された `AZURE_CLIENT_ID` / `AZURE_TENANT_ID` / `AZURE_SUBSCRIPTION_ID` を GitHub の Secrets に登録（`gh` CLI があればスクリプトが自動登録も可能）。

### デプロイ
```bash
git push origin main          # 以降は push のたびに自動デプロイ
```
完了後、Actions のジョブサマリにフロントエンドURLが表示されます。

> 詳細な手順・仕組み・注意点（SQLite単一レプリカ制約／コールドスタート／WAL禁止／PostgreSQL移行の目安）は **[docs/DEPLOY.md](docs/DEPLOY.md)** を参照。
