import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepperProps {
  steps: string[];
  /** 現在のステップ（1始まり）。これより前は完了扱い。 */
  current: number;
}

/** 横並びステップ表示。スマホでは横スクロール。 */
export function Stepper({ steps, current }: StepperProps) {
  return (
    <div className="-mx-1 overflow-x-auto pb-1">
      <ol className="flex min-w-max items-center gap-1 px-1">
        {steps.map((label, i) => {
          const idx = i + 1;
          const done = idx < current;
          const active = idx === current;
          return (
            <li key={label} className="flex items-center">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors",
                    done && "bg-brand-600 text-white",
                    active && "bg-brand-600 text-white ring-4 ring-brand-100",
                    !done && !active && "bg-slate-200 text-slate-500",
                  )}
                >
                  {done ? <Check size={14} /> : idx}
                </span>
                <span
                  className={cn(
                    "whitespace-nowrap text-xs font-medium",
                    active ? "text-brand-700" : done ? "text-slate-600" : "text-slate-400",
                  )}
                >
                  {label}
                </span>
              </div>
              {idx < steps.length && (
                <span
                  className={cn(
                    "mx-2 h-px w-6 sm:w-10",
                    done ? "bg-brand-400" : "bg-slate-200",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
