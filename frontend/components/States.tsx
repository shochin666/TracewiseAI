import { Loader2, AlertTriangle, Inbox } from "lucide-react";

/** ローディング表示。 */
export function LoadingState({ label = "読み込み中…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-16 text-slate-400">
      <Loader2 className="animate-spin text-brand-500" size={28} />
      <p className="text-sm">{label}</p>
    </div>
  );
}

/** エラー表示。 */
export function ErrorState({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-12 px-4 text-center">
      <AlertTriangle className="text-red-500" size={28} />
      <p className="text-sm font-medium text-red-700">{message}</p>
      {hint && <p className="text-xs text-red-500">{hint}</p>}
    </div>
  );
}

/** 空データ表示。 */
export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-12 text-slate-400">
      <Inbox size={28} />
      <p className="text-sm">{message}</p>
    </div>
  );
}
