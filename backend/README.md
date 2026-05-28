# backend — FastAPI + SQLite

ねじメッキ工程 不具合登録・AI原因分析システムのバックエンドAPI。

## 構成

```
app/
  main.py            FastAPIエントリ（起動時にDB初期化＋サンプル投入）
  database.py        sqlite3接続・スキーマ初期化
  models.py          テーブルDDL・定数
  schemas.py         Pydanticスキーマ
  seed.py            サンプルデータ投入
  analysis_engine.py AI風 原因分析（ルールベース＋スコアリング）
  report_generator.py 報告書下書き生成
  routers/           lots / defects / analysis / reports / dashboard / knowledge
data/
  tracewise.db       実行時に自動生成されるSQLite（gitignore対象）
```

## セットアップと起動

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# DB初期化＋サンプルデータ投入（任意。起動時にも自動で空なら投入される）
python -m app.seed

# 開発サーバ起動（http://localhost:8000）
uvicorn app.main:app --reload --port 8000
```

- API ドキュメント: http://localhost:8000/docs
- ヘルスチェック: http://localhost:8000/api/health
- デモを初期状態へ戻す: `POST http://localhost:8000/api/admin/reseed`

## 環境変数

| 変数 | 既定値 | 説明 |
| --- | --- | --- |
| `TRACEWISE_DB_PATH` | `backend/data/tracewise.db` | SQLiteファイルの場所 |
| `FRONTEND_ORIGIN` | `http://localhost:3000` | CORS許可するフロントエンドのオリジン |

## API一覧

| メソッド | パス | 説明 |
| --- | --- | --- |
| GET | `/api/lots/{lot_id}` | ロット情報（製品情報込み）を返す |
| POST | `/api/defects` | 不具合を登録する |
| GET | `/api/defects/{defect_id}` | 不具合詳細を返す |
| GET | `/api/analysis/{defect_id}` | 工程紐づけ・原因候補・確認項目を返す |
| POST | `/api/analysis/{defect_id}/investigation-results` | 確認結果を保存する |
| GET | `/api/reports/{defect_id}` | 報告書下書きを返す |
| POST | `/api/reports/{defect_id}/approve` | 承認しナレッジ化する |
| GET | `/api/dashboard/summary` | ダッシュボード集計を返す |
| GET | `/api/knowledge` | 承認済みナレッジ一覧（フィルタ可） |

## AI風分析ロジックについて

`analysis_engine.py` は本物のLLMを使わず、工程知識・管理基準・FMEA風ルールで
原因候補をスコアリングする。承認済みナレッジ（`knowledge_cases`）の類似事例で
スコアを補正する。**原因は断定せず、原因候補と確認項目を提示する**。
詳細はルートの `README.md` を参照。
