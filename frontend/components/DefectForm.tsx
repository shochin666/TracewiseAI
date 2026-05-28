"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Info, ArrowRight } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import {
  cn,
  DEFECT_TYPES,
  FOUND_AT_OPTIONS,
  TEMP_ACTION_OPTIONS,
  defectRate,
} from "@/lib/utils";
import { Card, CardBody, CardHeader } from "./Card";
import { Button } from "./Button";

function ChipGroup({
  options,
  value,
  onChange,
}: {
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={cn(
            "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
            value === opt
              ? "border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-200"
              : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50",
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-sm font-medium text-slate-700">
      {children}
      {required && <span className="ml-1 text-red-500">*</span>}
    </label>
  );
}

interface DefectFormProps {
  lotId: string;
}

/** 不具合登録フォーム。現場担当者は「見た事実」だけを入力する。 */
export function DefectForm({ lotId }: DefectFormProps) {
  const router = useRouter();
  const [defectType, setDefectType] = useState("");
  const [defectCount, setDefectCount] = useState("");
  const [inspectedCount, setInspectedCount] = useState("");
  const [foundAt, setFoundAt] = useState("");
  const [tempAction, setTempAction] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const count = Number(defectCount);
  const inspected = Number(inspectedCount);
  const rate =
    defectCount && inspectedCount && inspected > 0 ? defectRate(count, inspected) : null;

  const validate = (): string | null => {
    if (!defectType) return "不具合種別を選択してください。";
    if (!defectCount || count < 0) return "発生数を正しく入力してください。";
    if (!inspectedCount || inspected <= 0) return "検査数を正しく入力してください。";
    if (count > inspected) return "発生数が検査数を超えています。";
    if (!foundAt) return "発見場所を選択してください。";
    if (!tempAction) return "暫定対応を選択してください。";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.createDefect({
        lot_id: lotId,
        defect_type: defectType,
        defect_count: count,
        inspected_count: inspected,
        found_at_process: foundAt,
        temporary_action: tempAction,
        note: note.trim(),
      });
      // 登録後、分析画面へ
      router.push(`/analysis/${res.defect_id}`);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "登録に失敗しました。";
      setError(msg);
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="不具合情報の入力"
        subtitle="現場担当者は『見た事実』だけを入力します。原因の入力は不要です。"
      />
      <CardBody>
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-brand-50 px-3 py-2.5 text-xs text-brand-700">
          <Info size={15} className="mt-0.5 shrink-0" />
          <p>
            原因の推定はシステムが行います。ここでは「何が・どれだけ・どこで見つかったか」と暫定対応だけを記録してください。
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <FieldLabel required>不具合種別</FieldLabel>
            <ChipGroup options={DEFECT_TYPES} value={defectType} onChange={setDefectType} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <FieldLabel required>発生数</FieldLabel>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={defectCount}
                onChange={(e) => setDefectCount(e.target.value)}
                placeholder="例: 48"
                className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-200"
              />
            </div>
            <div>
              <FieldLabel required>検査数</FieldLabel>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={inspectedCount}
                onChange={(e) => setInspectedCount(e.target.value)}
                placeholder="例: 1000"
                className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-200"
              />
            </div>
            <div>
              <FieldLabel>不良率（自動計算）</FieldLabel>
              <div className="flex h-11 items-center rounded-lg border border-slate-200 bg-slate-50 px-3">
                <span className="tabular text-sm font-semibold text-slate-700">
                  {rate != null ? `${rate} %` : "—"}
                </span>
              </div>
            </div>
          </div>

          <div>
            <FieldLabel required>発見場所</FieldLabel>
            <ChipGroup options={FOUND_AT_OPTIONS} value={foundAt} onChange={setFoundAt} />
          </div>

          <div>
            <FieldLabel required>暫定対応</FieldLabel>
            <ChipGroup options={TEMP_ACTION_OPTIONS} value={tempAction} onChange={setTempAction} />
          </div>

          <div>
            <FieldLabel>補足メモ</FieldLabel>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="例: 出荷前の外観検査で点状に白っぽい変色を確認"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-200"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 size={18} className="animate-spin" /> 登録して分析中…
              </>
            ) : (
              <>
                登録して原因分析へ <ArrowRight size={18} />
              </>
            )}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
