# Azure へのデプロイ手順（CI/CD）

**ブランチごとに環境を分けて** `GitHub Actions → Azure Container Apps` に自動デプロイします。
マネージドサービス中心・低コスト（無アクセス時は 0 スケール）の構成です。

| ブランチ | GitHub Environment | リソースグループ | 名前接頭辞 |
| --- | --- | --- | --- |
| `develop` | `development` | `tracewise-dev-rg` | `tracewise-dev` |
| `main` | `production` | `tracewise-prod-rg` | `tracewise-prod` ※当面未使用 |

> 当面は **dev 環境のみ** 運用します（`develop` への push でデプロイ）。
> prod 追加方法は「§10. prod環境を後から足す」を参照。

---

## 1. 構成

```
                ┌──────────────── GitHub Actions（OIDC） ────────────────┐
   git push ─▶  │ platform.bicep → ACRビルド → apps.bicep                 │
                └────────────────────────┬───────────────────────────────┘
                                         ▼
[ユーザー] ─ HTTPS ─▶  Azure Container Apps 環境
                        ├─ frontend (Next.js)  外部Ingress＝公開 / 0〜2レプリカ
                        │      │  /api/* を rewrites でプロキシ
                        │      ▼
                        └─ backend (FastAPI)   内部Ingress＝非公開 / 1レプリカ固定
                                  │  /app/data にマウント
                                  ▼
                           Azure Files（SQLite を永続化）

  イメージ: Azure Container Registry / pull はユーザー割り当てマネージドID
  ログ    : Log Analytics
```

| 項目 | 採用 | 理由 |
| --- | --- | --- |
| 実行基盤 | Azure Container Apps（従量・0スケール） | コンテナをそのまま載せられ、無アクセス時はほぼ無課金 |
| API接続 | Next.js が `/api/*` を backend へプロキシ | backend を**非公開**にでき、CORS不要・ビルド時URL問題も回避 |
| DB | SQLite を **Azure Files** に永続化 | PostgreSQL の固定費を避け、現状コードのまま運用（小規模専用） |
| 認証 | GitHub→Azure は **OIDC** | 長期シークレットを GitHub に置かない |
| レジストリ | Azure Container Registry | ACA との連携が素直。pull はマネージドID（シークレットレス） |

### 関連ファイル
- `backend/Dockerfile.prod` / `frontend/Dockerfile.prod` … 本番イメージ（フロントは Next.js standalone）
- `infra/platform.bicep` … 基盤（ACR / ログ / ストレージ＋共有 / ACA環境 / pull用ID）
- `infra/apps.bicep` … アプリ2つ（backend=内部, frontend=公開）
- `infra/setup-azure-oidc.sh` … OIDC初期設定
- `.github/workflows/deploy.yml` … パイプライン本体

---

## 2. 前提

- Azure サブスクリプション（リソース作成権限）
- ローカルに **Azure CLI**（`az`）導入済み
- GitHub リポジトリ（Actions が使えること）

---

## 3. 最初の1回だけ：dev環境のOIDC初期設定

### 3-1. GitHub Environment を作る（Web UI）
1. リポジトリの **Settings → Environments → New environment** で `development` を作成
2. その Environment の **Variables** に2つ追加:
   - `RESOURCE_GROUP` = `tracewise-dev-rg`
   - `NAME_PREFIX` = `tracewise-dev`

### 3-2. Azure側を作成（スクリプト1発）
```bash
az login
bash infra/setup-azure-oidc.sh
# リポジトリを自動判定できない場合:
#   GITHUB_REPO=your-org/your-repo bash infra/setup-azure-oidc.sh
```

スクリプトは次を行い、最後に GitHub Secrets 用の3つの値を出力します。

1. リソースグループ作成（dev は `tracewise-dev-rg` / `japaneast`）
2. Entra アプリ登録＋サービスプリンシパル作成 or 再利用（OIDC）
3. リソースグループへ **Owner** ロール割り当て
   （`apps.bicep` が pull用ID へロールを付与するため `roleAssignments/write` 権限が必要）
4. **GitHub Environment 紐付け**のフェデレーション資格情報を登録
   （subject = `repo:<owner>/<repo>:environment:development`）

### 3-3. GitHub Secrets を登録（Web UI）
**Settings → Secrets and variables → Actions → Repository secrets** に以下3つを登録
（`gh` CLI があればスクリプトから自動登録も可）:

| Secret | 内容 |
| --- | --- |
| `AZURE_CLIENT_ID` | アプリ登録のクライアントID |
| `AZURE_TENANT_ID` | テナントID |
| `AZURE_SUBSCRIPTION_ID` | サブスクリプションID |

> パスワード/クライアントシークレットは**作りません**（OIDC＝フェデレーション認証）。

---

## 4. デプロイ（dev環境）

```bash
git checkout -b develop      # 初回のみ。以降は develop で作業
git push -u origin develop   # ブランチ作成＆push（以降 push のたびに自動デプロイ）
```

`backend/**` `frontend/**` `infra/**` `.github/workflows/deploy.yml` の変更で起動します。
GitHub の **Actions** タブから手動実行（Run workflow）も可能です。

### パイプラインの流れ
1. OIDC で Azure ログイン（環境ごとの federated credential を使用）
2. GitHub Environment の Variables から `RESOURCE_GROUP` / `NAME_PREFIX` を取得
3. リソースグループ作成（冪等）
4. `platform.bicep` をデプロイ（基盤）
5. backend の内部FQDN `<NAME_PREFIX>-backend.internal.<env既定ドメイン>` を算出
6. `az acr build` で backend / frontend をクラウドビルド＆プッシュ
   - frontend は `--build-arg BACKEND_ORIGIN=<上記FQDN>` を注入
7. `apps.bicep` をデプロイ（アプリ2つ）
8. 完了後、Actions のジョブサマリに **フロントエンドURL** を表示

デプロイ完了後、表示された `https://<NAME_PREFIX>-frontend.<...>.azurecontainerapps.io` を開けば動作します。

---

## 5. 仕組みのポイント

### なぜ frontend が backend をプロキシするのか
ブラウザは frontend（公開）だけを叩き、`/api/*` は Next.js の `rewrites` が backend（**内部Ingress＝非公開**）へ中継します。
これにより **CORS不要**・**backend をインターネットに晒さない**・**ビルド時にbackend URLを知らなくてよい**を同時に満たします。

`output: "standalone"` ではリライト先がビルド時に確定するため、CI は backend の内部FQDNを **build-arg** で焼き込みます
（ランタイム環境変数にも同値を渡し、念のため両対応にしています）。

### SQLite を Azure Files に置く
backend イメージはDBファイルを持たず、`/app/data` に Azure Files をマウントします。
これでコンテナの再デプロイ・スケール・再起動でもデータが残ります。
初回起動時、空であればサンプルデータが自動投入されます。

### スケールとコスト
- **backend**：`minReplicas=0 / maxReplicas=1`（**1固定**。SQLite は単一ライタ前提）
- **frontend**：`minReplicas=0 / maxReplicas=2`（ステートレス。負荷で増減可）
- 無アクセス時は両方 0 へ縮退 → ほぼ無課金。最初のアクセスはコールドスタート（数秒）。
- 0.25 vCPU / 0.5GiB の最小構成。

---

## 6. 注意点・割り切り

- **SQLite はスケールしない**：backend は必ず1レプリカ。複数レプリカ/複数workerにすると**DB破損**の恐れ。
- **Azure Files 上で WAL を使わない**：SMB は共有メモリ非対応のため。既定のロールバックジャーナルのまま運用（コードもそのまま）。
- **コールドスタート**：0スケールのため、無アクセス後の初回は起動待ちが発生。常時即応が必要なら backend を `minReplicas=1` に（`apps.bicep`）。
- **本格運用に移るなら PostgreSQL へ**：複数人で同時利用・データ保全・バックアップが必要になったら、SQLite→**Azure Database for PostgreSQL** が移行の合図です（`backend/app/database.py` の置き換えが必要）。

---

## 7. ローカルで本番イメージを確認（任意）

```bash
# frontend（standalone）。BACKEND_ORIGIN は確認用ダミーでも可
docker build -f frontend/Dockerfile.prod \
  --build-arg NEXT_PUBLIC_API_BASE_URL= \
  --build-arg BACKEND_ORIGIN=http://host.docker.internal:8000 \
  -t tracewise-frontend:local frontend
docker run --rm -p 3000:3000 tracewise-frontend:local

# backend
docker build -f backend/Dockerfile.prod -t tracewise-backend:local backend
docker run --rm -p 8000:8000 tracewise-backend:local
```

> 日常の開発は従来どおり `docker compose up`（開発モード・ホットリロード）を使ってください。

---

## 8. トラブルシュート

| 症状 | 対処 |
| --- | --- |
| ログインで権限エラー | Secrets（CLIENT_ID/TENANT_ID/SUBSCRIPTION_ID）と、フェデレーション資格情報の `subject`（`...:ref:refs/heads/main`）がブランチと一致しているか確認 |
| ロール割り当てで失敗 | デプロイ用SPが対象RGの **Owner** か確認（`setup-azure-oidc.sh` を再実行） |
| 初回だけイメージ pull 失敗 | マネージドID権限の伝播待ち。ワークフローを再実行すると解消することが多い |
| フロントは出るが API エラー | backend がコールドスタート中の可能性。少し待って再読込。続く場合は backend のリビジョン状態とログ（Log Analytics）を確認 |
| デモを初期化したい | 公開された frontend 経由は管理APIを通さないため、必要なら backend を一時的に再デプロイ、またはローカル同様 `POST /api/admin/reseed` を内部から実行 |

---

## 9. 後片付け（課金を止める）

```bash
az group delete -n tracewise-dev-rg --yes --no-wait     # dev環境を完全削除
# prod を運用中なら:
#   az group delete -n tracewise-prod-rg --yes --no-wait
```

リソースグループごと削除すれば、関連リソース（ACA・ACR・ストレージ・ログ）がまとめて消えます。

---

## 10. prod環境を後から足す

dev で慣れたら最小手数で本番を増設できます（Bicepは同じ・接頭辞だけ違う）。

1. **GitHub Environment 作成**：`Settings → Environments → New environment` で `production` を作成
   - **Deployment branches**: `main` のみに制限
   - **Required reviewers**: 自分を指定（push時に手動承認が要るようにすると安全）
   - **Variables** に `RESOURCE_GROUP = tracewise-prod-rg` / `NAME_PREFIX = tracewise-prod` を設定
2. **Azure側**:
   ```bash
   ENVIRONMENT=production bash infra/setup-azure-oidc.sh
   ```
   （Entraアプリは共有。prod用RGとフェデレーション資格情報だけが追加される）
3. **ワークフローを有効化**：`.github/workflows/deploy.yml` の `branches: [develop]` を `branches: [develop, main]` に変更してコミット
4. **昇格**：`develop` → `main` への PR をマージ → 承認 → prod自動デプロイ
