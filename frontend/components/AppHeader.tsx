"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BookOpen, ScanLine, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "ホーム", icon: FlaskConical, exact: true },
  { href: "/dashboard", label: "ダッシュボード", icon: LayoutDashboard, exact: false },
  { href: "/knowledge", label: "ナレッジ", icon: BookOpen, exact: false },
];

export function AppHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">
            <ScanLine size={18} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold leading-tight text-slate-800">
              TraceWise-AI
            </span>
            <span className="hidden text-[10px] leading-tight text-slate-400 sm:block">
              ねじメッキ工程 不具合・原因分析
            </span>
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          {NAV.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm",
                  active
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-700",
                )}
              >
                <Icon size={16} />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
