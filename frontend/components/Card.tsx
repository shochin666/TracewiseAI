import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

/** 白カードのコンテナ。 */
export function Card({ children, className }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white shadow-card",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: LucideIcon;
  action?: React.ReactNode;
  className?: string;
}

/** カード見出し（アイコン＋タイトル＋右側アクション）。 */
export function CardHeader({ title, subtitle, icon: Icon, action, className }: CardHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {Icon && (
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Icon size={18} />
          </span>
        )}
        <div>
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function CardBody({ children, className }: CardProps) {
  return <div className={cn("px-5 py-4", className)}>{children}</div>;
}
