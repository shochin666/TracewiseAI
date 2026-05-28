#!/usr/bin/env bash
# ============================================================
#  GitHub Actions から Azure へ OIDC でデプロイするための初期設定（環境ごとに1回）
#
#  既定は「開発環境(development)」のセットアップ。本番(production) を追加するときは
#  ENVIRONMENT=production を指定して再実行する（Entraアプリは共有・追加でロールと
#  フェデレーション資格情報だけが作成される）。
#
#  この実行で行うこと:
#   1. 環境別リソースグループを作成（例: tracewise-dev-rg / tracewise-prod-rg）
#   2. Entra アプリ登録 + サービスプリンシパルを作成/再利用（OIDC・シークレット無し）
#   3. リソースグループに Owner ロールを割り当て
#      （apps.bicep が pull用IDへロール付与するため、roleAssignments 権限が必要）
#   4. GitHub Environment 紐付けのフェデレーション資格情報を登録
#      （subject: repo:OWNER/REPO:environment:<ENVIRONMENT>）
#   5. GitHub Secrets に登録すべき値を出力
#
#  前提:
#    ・az CLI 導入済み・'az login' 済み
#    ・実行の前に GitHub の Settings → Environments で対象 Environment
#      （development / production）を作成し、Variables を設定しておくこと
#         RESOURCE_GROUP = tracewise-dev-rg  / tracewise-prod-rg
#         NAME_PREFIX    = tracewise-dev     / tracewise-prod
#
#  使い方:
#     az login
#     bash infra/setup-azure-oidc.sh                          # → development
#     ENVIRONMENT=production bash infra/setup-azure-oidc.sh   # → production
#     # リポジトリを自動判定できない場合: GITHUB_REPO=org/repo を追加
# ============================================================
set -euo pipefail

# ---- 設定（環境変数で上書き可。deploy.yml の Environment Variables と合わせる）----
ENVIRONMENT="${ENVIRONMENT:-development}"
case "$ENVIRONMENT" in
  development) ENV_SHORT="dev" ;;
  production)  ENV_SHORT="prod" ;;
  *)           ENV_SHORT="$ENVIRONMENT" ;;
esac

APP_NAME="${APP_NAME:-tracewise-github-oidc}"            # 全環境で共有する1つのEntraアプリ
RESOURCE_GROUP="${RESOURCE_GROUP:-tracewise-${ENV_SHORT}-rg}"
NAME_PREFIX="${NAME_PREFIX:-tracewise-${ENV_SHORT}}"
LOCATION="${LOCATION:-japaneast}"
GITHUB_REPO="${GITHUB_REPO:-}"                            # "org/repo" 形式。未指定なら git remote から推定。

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
echo " Environment  : $ENVIRONMENT  (short: $ENV_SHORT)"
echo " Subscription : $SUBSCRIPTION_ID"
echo " Tenant       : $TENANT_ID"
echo " Repository   : $GITHUB_REPO"
echo " ResourceGroup: $RESOURCE_GROUP ($LOCATION)"
echo " NamePrefix   : $NAME_PREFIX"
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

# ---- 3. ロール割り当て（このリソースグループに Owner）----
az role assignment create \
  --assignee-object-id "$SP_OBJECT_ID" \
  --assignee-principal-type ServicePrincipal \
  --role "Owner" \
  --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP" \
  --only-show-errors -o none 2>/dev/null \
  && echo "[3/4] Owner ロールを割り当てました（scope: ${RESOURCE_GROUP}）。" \
  || echo "[3/4] Owner ロールは既に割り当て済みです。"

# ---- 4. フェデレーション資格情報（GitHub Environment 紐付け）----
SUBJECT="repo:${GITHUB_REPO}:environment:${ENVIRONMENT}"
FC_NAME="github-${ENV_SHORT}"
EXISTS="$(az ad app federated-credential list --id "$APP_ID" --query "length([?subject=='$SUBJECT'])" -o tsv)"
if [[ "$EXISTS" == "0" ]]; then
  az ad app federated-credential create --id "$APP_ID" --parameters "{
    \"name\": \"$FC_NAME\",
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
 次にやること
============================================================
 1) GitHub の Settings → Environments で「${ENVIRONMENT}」を作成し、
    Environment variables に以下を設定（未設定なら）:
       RESOURCE_GROUP = ${RESOURCE_GROUP}
       NAME_PREFIX    = ${NAME_PREFIX}

 2) GitHub の Settings → Secrets and variables → Actions の
    Repository secrets に以下3つを登録（全環境共通・既登録ならスキップ）:
       AZURE_CLIENT_ID       = $APP_ID
       AZURE_TENANT_ID       = $TENANT_ID
       AZURE_SUBSCRIPTION_ID = $SUBSCRIPTION_ID

 3) 該当ブランチへ push して自動デプロイ:
       ${ENVIRONMENT} → $( [[ "$ENVIRONMENT" == "production" ]] && echo "git push origin main" || echo "git push origin develop" )
============================================================
EOF

# ---- gh があれば自動登録（任意）----
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  read -r -p "gh CLI で上記 Repository Secrets を自動登録しますか? [y/N] " ans
  if [[ "${ans:-N}" =~ ^[Yy]$ ]]; then
    gh secret set AZURE_CLIENT_ID       -b "$APP_ID"           -R "$GITHUB_REPO"
    gh secret set AZURE_TENANT_ID       -b "$TENANT_ID"        -R "$GITHUB_REPO"
    gh secret set AZURE_SUBSCRIPTION_ID -b "$SUBSCRIPTION_ID"  -R "$GITHUB_REPO"
    echo "GitHub Secrets を登録しました。"
  fi
fi
