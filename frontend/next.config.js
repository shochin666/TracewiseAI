/** @type {import('next').NextConfig} */

// プロキシ先 backend オリジン（例: https://tracewise-backend.internal.<env>.azurecontainerapps.io）。
// 本番は frontend/Dockerfile.prod の build-arg で渡され、ビルド時に rewrites へ焼き込まれる
// （output:"standalone" では rewrites はビルド時に確定するため）。
// ローカル開発では未設定 → プロキシせず、ブラウザは NEXT_PUBLIC_API_BASE_URL で backend を直接叩く。
const backendOrigin = process.env.BACKEND_ORIGIN;

const nextConfig = {
  reactStrictMode: true,
  // Docker 本番イメージを小さくするための自己完結ビルド出力。
  output: "standalone",
  async rewrites() {
    if (!backendOrigin) return [];
    // ブラウザは同一オリジンの /api/* を叩き、ここで backend(内部Ingress)へ中継する。
    return [{ source: "/api/:path*", destination: `${backendOrigin}/api/:path*` }];
  },
};

module.exports = nextConfig;
