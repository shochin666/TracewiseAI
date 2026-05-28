import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type Accent = "brand" | "emerald" | "amber" | "red" | "slate" | "indigo";

const ACCENTS: Record<Accent, { icon: string; value: string }> = {
  brand: { icon: "bg-brand-50 text-brand-600", value: "text-brand-700" },
  emerald: { icon: "bg-emerald-50 text-emerald-600", value: "text-emerald-700" },
  amber: { icon: "bg-amber-50 text-amber-600", value: "text-amber-700" },
  red: { icon: "bg-red-50 text-red-600", value: "text-red-700" },
  indigo: { icon: "bg-indigo-50 text-indigo-600", value: "text-indigo-700" },
  slate: { icon: "bg-slate-100 text-slate-600", value: "text-slate-800" },
};

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  unit?: string;
  sub?: string;
  icon?: LucideIcon;
  accent?: Accent;
}

/** ダッシュボード等で使う数値カード。 */
export function StatCard({ label, value, unit, sub, icon: Icon, accent = "brand" }: StatCardProps) {
  const a = ACCENTS[accent];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        {Icon && (
          <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", a.icon)}>
            <Icon size={18} />
          </span>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className={cn("tabular text-2xl font-bold", a.value)}>{value}</span>
        {unit && <span className="text-sm font-medium text-slate-400">{unit}</span>}
      </div>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}
