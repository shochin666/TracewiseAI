import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppHeader } from "@/components/AppHeader";

export const metadata: Metadata = {
  title: "ねじメッキ工程 不具合登録・AI原因分析システム",
  description:
    "QRコードでロットを特定し、工程データから原因候補と報告書を自動生成するデモシステム",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <div className="flex min-h-screen flex-col">
          <AppHeader />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
            {children}
          </main>
          <footer className="border-t border-slate-200 bg-white py-4">
            <p className="mx-auto max-w-6xl px-4 text-center text-xs text-slate-400">
              TraceWise-AI デモ — AIは原因を断定せず、原因候補と確認項目を提示します。
              最終原因は品質担当者の承認で確定します。
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
