#!/usr/bin/env bash
# ============================================================
#  GitHub Actions から Azure へ OIDC でデプロイするための初期設定（1回だけ実行）
#
#  実行すること:
#   1. リソースグループを作成（ロールをここに限定するため）
#   2. Entra アプリ登録 + サービスプリンシパルを作成（OIDC。シークレットは作らない）
#   3. リソースグループに Owner ロールを割り当て
#      （apps.bicep が pull用IDへロール付与するため、roleAssignments 権限が必要）
#   4. GitHub リポジトリ用のフェデレーション資格情報を登録（main ブランチ）
#   5. GitHub Secrets に登録すべき値を出力（gh があれば自動登録も可）
#
#  前提: az CLI 導入済み・'az login' 済み。
#  使い方:
#     az login
#     bash infra/setup-azure-oidc.sh
#     # リポジトリを自動判定できない場合: GITHUB_REPO=org/repo bash infra/setup-azure-oidc.sh
# ============================================================
set -euo pipefail

# ---- 設定（環境変数で上書き可。deploy.yml の既定値と合わせている）----
APP_NAME="${APP_NAME:-tracewise-github-oidc}"
RESOURCE_GROUP="${RESOURCE_GROUP:-tracewise-rg}"
LOCATION="${LOCATION:-japaneast}"
GITHUB_REPO="${GITHUB_REPO:-}" # "org/repo" 形式。未指定なら git remote から推定。

# ---- 前提チェック ----
command -v az >/dev/null 2>&1 || { echo "エラー: az CLI が見つかりません。"; exit 1; }
az account show >/dev/null 2>&1 || { echo "エラー: 先に 'az login' を実行してください。"; exit 1; }

# ---- リポジトリ判定（org/repo）----
if [[ -z "$GITHUB_REPO" ]]; then
  url="$(git config --get remote.origin.url 2>/dev/null || true)"
  # git@host:org/repo(.git) / https://host/org/repo(.git) のどちらでも org/repo を取り出す。
  GITHUB_REPO="$(printf '%s' "$url" | sed -E 's#^git@[^:]+:##; s#^https?://[^/]+/##; s#\.git$##')"
fi
if [[ -z "$GITHUB_REPO" || "$GITHUB_REPO" != */* ]]; then
  echo "エラー: GitHub リポジトリを判定できません。GITHUB_REPO=org/repo を指定して再実行してください。"
  exit 1
fi

SUBSCRIPTION_ID="$(az account show --query id -o tsv)"
TENANT_ID="$(az account show --query tenantId -o tsv)"

echo "============================================================"
echo " Subscription : $SUBSCRIPTION_ID"
echo " Tenant       : $TENANT_ID"
echo " Repository   : $GITHUB_REPO"
echo " ResourceGroup: $RESOURCE_GROUP ($LOCATION)"
echo " App 名        : $APP_NAME"
echo "============================================================"

# ---- 1. リソースグループ（ロールをここに絞るため先に作成）----
az group create -n "$RESOURCE_GROUP" -l "$LOCATION" -o none
echo "[1/4] リソースグループを用意しました。"

# ---- 2. Entra アプリ登録 + サービスプリンシパル（冪等）----
APP_ID="$(az ad app list --display-name "$APP_NAME" --query "[0].appId" -o tsv)"
if [[ -z "$APP_ID" ]]; then
  APP_ID="$(az ad app create --display-name "$APP_NAME" --query appId -o tsv)"
  echo "[2/4] アプリ登録を作成: $APP_ID"
else
  echo "[2/4] 既存のアプリ登録を再利用: $APP_ID"
fi
az ad sp show --id "$APP_ID" >/dev/null 2>&1 || az ad sp create --id "$APP_ID" -o none
SP_OBJECT_ID="$(az ad sp show --id "$APP_ID" --query id -o tsv)"

# ---- 3. ロール割り当て（リソースグループに Owner）----
az role assignment create \
  --assignee-object-id "$SP_OBJECT_ID" \
  --assignee-principal-type ServicePrincipal \
  --role "Owner" \
  --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP" \
  --only-show-errors -o none 2>/dev/null \
  && echo "[3/4] Owner ロールを割り当てました（scope: ${RESOURCE_GROUP}）。" \
  || echo "[3/4] Owner ロールは既に割り当て済みです。"

# ---- 4. フェデレーション資格情報（main ブランチ）----
SUBJECT="repo:${GITHUB_REPO}:ref:refs/heads/main"
EXISTS="$(az ad app federated-credential list --id "$APP_ID" --query "length([?subject=='$SUBJECT'])" -o tsv)"
if [[ "$EXISTS" == "0" ]]; then
  az ad app federated-credential create --id "$APP_ID" --parameters "{
    \"name\": \"github-main\",
    \"issuer\": \"https://token.actions.githubusercontent.com\",
    \"subject\": \"$SUBJECT\",
    \"audiences\": [\"api://AzureADTokenExchange\"]
  }" -o none
  echo "[4/4] フェデレーション資格情報を作成: $SUBJECT"
else
  echo "[4/4] フェデレーション資格情報は既に存在: $SUBJECT"
fi

# ---- 結果出力 ----
cat <<EOF

============================================================
 GitHub の Secrets に以下を登録してください
 （リポジトリ → Settings → Secrets and variables → Actions）
------------------------------------------------------------
 AZURE_CLIENT_ID       = $APP_ID
 AZURE_TENANT_ID       = $TENANT_ID
 AZURE_SUBSCRIPTION_ID = $SUBSCRIPTION_ID
============================================================
EOF

# ---- gh があれば自動登録（任意）----
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  read -r -p "gh CLI で上記 Secrets を自動登録しますか? [y/N] " ans
  if [[ "${ans:-N}" =~ ^[Yy]$ ]]; then
    gh secret set AZURE_CLIENT_ID       -b "$APP_ID"           -R "$GITHUB_REPO"
    gh secret set AZURE_TENANT_ID       -b "$TENANT_ID"        -R "$GITHUB_REPO"
    gh secret set AZURE_SUBSCRIPTION_ID -b "$SUBSCRIPTION_ID"  -R "$GITHUB_REPO"
    echo "GitHub Secrets を登録しました。"
  fi
fi

echo "完了。次は 'git push origin main' で自動デプロイされます（または GitHub Actions を手動実行）。"
