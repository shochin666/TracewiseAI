// ============================================================
//  アプリ本体（Container Apps を2つ）。platform.bicep の後にデプロイする。
//
//   - backend  : 内部 Ingress（非公開）。Azure Files を /app/data にマウント。
//                SQLite 単一ライタ前提のため maxReplicas=1 に固定。
//   - frontend : 外部 Ingress（公開）。/api/* を backend(内部)へプロキシ。
//                ステートレスなので 0〜2 レプリカでスケール可。
//
//  どちらも ACR からの pull はユーザー割り当てマネージドIDで行う（シークレット無し）。
// ============================================================

@description('デプロイ先リージョン')
param location string = resourceGroup().location

@description('リソース名の接頭辞')
param namePrefix string = 'tracewise'

@description('Container Apps 環境のリソースID（platform.bicep の出力）')
param envId string

@description('ACR ログインサーバ（例: tracewisexxxx.azurecr.io）')
param acrLoginServer string

@description('ACR pull 用ユーザー割り当てマネージドIDのリソースID')
param pullIdentityId string

@description('環境ストレージ名（platform.bicep の出力）')
param envStorageName string

@description('backend イメージ（例: <loginServer>/tracewise-backend:<tag>）')
param backendImage string

@description('frontend イメージ（例: <loginServer>/tracewise-frontend:<tag>）')
param frontendImage string

// --- backend（内部 Ingress + Azure Files マウント）---
resource backendApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${namePrefix}-backend'
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${pullIdentityId}': {}
    }
  }
  properties: {
    managedEnvironmentId: envId
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: false // 非公開（frontend からのみ到達可能）
        targetPort: 8000
        transport: 'auto'
        allowInsecure: false
      }
      registries: [
        {
          server: acrLoginServer
          identity: pullIdentityId
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'backend'
          image: backendImage
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: [
            {
              name: 'TRACEWISE_DB_PATH'
              value: '/app/data/tracewise.db'
            }
          ]
          volumeMounts: [
            {
              volumeName: 'data'
              mountPath: '/app/data'
            }
          ]
        }
      ]
      // SQLite は単一ファイル・単一ライタ前提のため、絶対に複数レプリカにしない。
      scale: {
        minReplicas: 0 // 無アクセス時は 0 に（コスト最小化。初回はコールドスタート）
        maxReplicas: 1 // 1 に固定（DB 破損防止）
      }
      volumes: [
        {
          name: 'data'
          storageType: 'AzureFile'
          storageName: envStorageName
        }
      ]
    }
  }
}

// --- frontend（外部 Ingress。/api を backend 内部へプロキシ）---
resource frontendApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${namePrefix}-frontend'
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${pullIdentityId}': {}
    }
  }
  properties: {
    managedEnvironmentId: envId
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true // 公開
        targetPort: 3000
        transport: 'auto'
        allowInsecure: false
      }
      registries: [
        {
          server: acrLoginServer
          identity: pullIdentityId
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'frontend'
          image: frontendImage
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: [
            {
              // standalone では rewrites はビルド時確定だが、念のためランタイムにも渡す（保険）。
              // 値は backend の内部 FQDN（<app>.internal.<env既定ドメイン>）。
              name: 'BACKEND_ORIGIN'
              value: 'https://${backendApp.properties.configuration.ingress.fqdn}'
            }
          ]
        }
      ]
      scale: {
        minReplicas: 0 // 無アクセス時は 0（コールドスタート許容でコスト最小化）
        maxReplicas: 2 // ステートレスなので必要に応じてスケールアウト可
      }
    }
  }
}

output frontendUrl string = 'https://${frontendApp.properties.configuration.ingress.fqdn}'
output backendInternalFqdn string = backendApp.properties.configuration.ingress.fqdn
