# 開発モード用イメージ（ホットリロード）。本番ビルドは行わない。
FROM node:20-alpine

WORKDIR /app

# 依存だけ先に入れる（package.json を変えた時だけ再ビルドが必要）
COPY package.json ./
RUN npm install --no-audit --no-fund

# ソースは compose 側でマウントするが、単体起動でも動くようコピーしておく
COPY . .

EXPOSE 3000

# Next.js 開発サーバ（ファイル保存で即反映）。-H 0.0.0.0 でコンテナ外から到達可能に。
CMD ["npm", "run", "dev"]
