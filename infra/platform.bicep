// ============================================================
//  プラットフォーム基盤（アプリより先に1回だけ作成 → 以降は冪等更新）
//
//  作成物:
//   - Container Registry（ACR / Basic, 管理者ユーザー無効）
//   - Log Analytics ワークスペース（Container Apps のログ送信先）
//   - ユーザー割り当てマネージドID（ACR からの pull 用。シークレット不要）
//   - ACR Pull ロール割り当て（上記 ID に付与）
//   - ストレージアカウント + ファイル共有（SQLite を永続化する Azure Files）
//   - Container Apps 環境（マネージド環境）+ 環境ストレージ（ファイル共有を接続）
//
//  ※ アプリ(コンテナ)本体は apps.bicep で別途デプロイする。
//     ID とロールを先に作っておくことで、アプリ初回デプロイ時の pull を確実にする。
// ============================================================

@description('デプロイ先リージョン')
param location string = resourceGroup().location

@description('リソース名の接頭辞')
param namePrefix string = 'tracewise'

// グローバル一意名を決め打ちで生成（ユーザーが一意名を考えなくてよいように）。
var suffix = uniqueString(resourceGroup().id)
var acrName = '${namePrefix}${suffix}' // 例: tracewiseabc123... (英数小文字, <=50)
var storageAccountName = '${namePrefix}${suffix}' // 英数小文字, <=24（種別が違うので名前衝突しない）
var fileShareName = 'tracewise-data'
var envStorageName = 'tracewisedata' // Container Apps 環境ストレージ名（英数小文字）

// --- Log Analytics（Container Apps のログ送信先）---
resource law 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: '${namePrefix}-logs'
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

// --- Container Registry（ACR）---
resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  sku: { name: 'Basic' }
  properties: {
    adminUserEnabled: false // 管理者ユーザーは使わない（マネージドID + AcrPull で pull する）
  }
}

// --- ACR pull 用のユーザー割り当てマネージドID ---
resource pullIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${namePrefix}-pull-id'
  location: location
}

// --- ACR Pull ロールを上記IDに付与（アプリより前に作って伝播を待たせる）---
var acrPullRoleId = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  '7f951dda-4ed3-4680-a7ca-43fe172d538d' // AcrPull
)
resource acrPullAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, pullIdentity.id, acrPullRoleId)
  scope: acr
  properties: {
    principalId: pullIdentity.properties.principalId
    roleDefinitionId: acrPullRoleId
    principalType: 'ServicePrincipal'
  }
}

// --- ストレージアカウント + ファイル共有（SQLite 永続化用）---
resource storage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageAccountName
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
  }
}

resource fileService 'Microsoft.Storage/storageAccounts/fileServices@2023-01-01' = {
  parent: storage
  name: 'default'
}

resource share 'Microsoft.Storage/storageAccounts/fileServices/shares@2023-01-01' = {
  parent: fileService
  name: fileShareName
  properties: {
    shareQuota: 5 // GiB（デモには十分。課金は使用量ベース）
  }
}

// --- Container Apps 環境（マネージド環境）---
resource env 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${namePrefix}-env'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: law.properties.customerId
        sharedKey: law.listKeys().primarySharedKey
      }
    }
  }
}

// --- 環境ストレージ（ファイル共有を環境に接続。アプリの Volume から参照する）---
resource envStorage 'Microsoft.App/managedEnvironments/storages@2024-03-01' = {
  parent: env
  name: envStorageName
  properties: {
    azureFile: {
      accountName: storage.name
      accountKey: storage.listKeys().keys[0].value
      shareName: fileShareName
      accessMode: 'ReadWrite'
    }
  }
}

// --- 出力（apps.bicep / ワークフローが利用）---
output acrName string = acr.name
output acrLoginServer string = acr.properties.loginServer
output pullIdentityId string = pullIdentity.id
output envId string = env.id
output envDefaultDomain string = env.properties.defaultDomain
output envStorageName string = envStorage.name
output storageAccountName string = storage.name
