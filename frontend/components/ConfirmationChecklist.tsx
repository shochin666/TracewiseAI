"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle, FileText } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { CheckItem, InvestigationResult, InvestigationResultValue } from "@/lib/types";
import { cn, INVESTIGATION_OPTIONS } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "./Card";
import { Button } from "./Button";
import { Badge } from "./Badge";

interface ConfirmationChecklistProps {
  defectId: number;
  checkItems: CheckItem[];
  existing: InvestigationResult[];
}

const OPTION_COLOR: Record<InvestigationResultValue, string> = {
  // 異常あり=色つき（背景そのまま）／異常なし=背景白（緑のボーダーと文字だけで選択を示す）。
  // 既定が「異常なし」なので、異常ありの項目だけが赤く目立つようにしている。
  abnormal: "border-red-400 bg-red-50 text-red-700 ring-red-200",
  normal: "border-emerald-400 bg-white text-emerald-700 ring-emerald-200",
  unchecked: "border-amber-400 bg-amber-50 text-amber-700 ring-amber-200",
  not_applicable: "border-slate-300 bg-slate-100 text-slate-600 ring-slate-200",
};

interface RowState {
  result: InvestigationResultValue;
  note: string;
}

export function ConfirmationChecklist({ defectId, checkItems, existing }: ConfirmationChecklistProps) {
  const router = useRouter();

  // 既存の確認結果でプリフィル
  const initial = useMemo(() => {
    const map: Record<string, RowState> = {};
    for (const ci of checkItems) {
      const found = existing.find((e) => e.check_item === ci.label);
      map[ci.label] = {
        // 既定は「異常なし」。異常があった項目だけ現場が「異常あり」に切り替える。
        result: (found?.result as InvestigationResultValue) ?? "normal",
        note: found?.note ?? "",
      };
    }
    return map;
  }, [checkItems, existing]);

  const [state, setState] = useState<Record<string, RowState>>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setResult = (label: string, result: InvestigationResultValue) =>
    setState((s) => ({ ...s, [label]: { ...s[label], result } }));
  const setNote = (label: string, note: string) =>
    setState((s) => ({ ...s, [label]: { ...s[label], note } }));

  const abnormalCount = Object.values(state).filter((r) => r.result === "abnormal").length;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const results: InvestigationResult[] = checkItems.map((ci) => ({
        check_item: ci.label,
        result: state[ci.label].result,
        note: state[ci.label].note.trim(),
      }));
      await api.saveInvestigationResults(defectId, results);
      router.push(`/reports/${defectId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "保存に失敗しました。");
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="確認結果の入力"
        subtitle="優先確認項目について、現場・品質で確認した結果を選択してください。"
        action={
          <Badge
            className={
              abnormalCount > 0
                ? "bg-red-100 text-red-700 border-red-200"
                : "bg-emerald-100 text-emerald-700 border-emerald-200"
            }
          >
            異常あり {abnormalCount}件
          </Badge>
        }
      />
      <CardBody>
        <div className="space-y-3">
          {checkItems.map((ci) => (
            <div key={ci.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500">
                    {ci.priority}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-700">{ci.label}</p>
                    <p className="text-[11px] text-slate-400">関連候補: {ci.cause}</p>
                  </div>
                </div>
                {state[ci.label]?.result === "abnormal" && (
                  <Badge className="bg-red-100 text-red-700 border-red-200" dot>
                    異常あり
                  </Badge>
                )}
              </div>
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                {INVESTIGATION_OPTIONS.map((opt) => {
                  const selected = state[ci.label]?.result === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setResult(ci.label, opt.value)}
                      className={cn(
                        "rounded-lg border px-2 py-1.5 text-xs font-medium transition-all",
                        selected
                          ? cn("ring-1", OPTION_COLOR[opt.value])
                          : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50",
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <input
                type="text"
                value={state[ci.label]?.note ?? ""}
                onChange={(e) => setNote(ci.label, e.target.value)}
                placeholder="メモ（実測値など）任意"
                className="mt-2 h-9 w-full rounded-lg border border-slate-200 px-2.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-200"
              />
            </div>
          ))}
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button onClick={handleSave} size="lg" className="mt-4 w-full" disabled={saving}>
          {saving ? (
            <>
              <Loader2 size={18} className="animate-spin" /> 保存中…
            </>
          ) : (
            <>
              <FileText size={18} /> 確認結果を保存して報告書を生成
            </>
          )}
        </Button>
      </CardBody>
    </Card>
  );
}
