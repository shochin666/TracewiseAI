import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
  /** 左に小さなドットを表示する */
  dot?: boolean;
}

/** 汎用バッジ。色は className で指定する（utils の *Class ヘルパーを渡す想定）。 */
export function Badge({ children, className, dot }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        className ?? "bg-slate-100 text-slate-600 border-slate-200",
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
      {children}
    </span>
  );
}
