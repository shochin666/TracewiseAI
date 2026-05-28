"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, Filter, RotateCcw, Loader2, CheckCircle2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { KnowledgeResponse } from "@/lib/types";
import { cn, recurrenceBadgeClass } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/States";

type Filters = {
  product_id: string;
  defect_type: string;
  confirmed_cause: string;
  surface_treatment: string;
};

const EMPTY: Filters = { product_id: "", defect_type: "", confirmed_cause: "", surface_treatment: "" };

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-slate-400">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-200"
      >
        <option value="">すべて</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function KnowledgePage() {
  const [data, setData] = useState<KnowledgeResponse | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 再発判定（後日確定）の状態
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback((f: Filters) => {
    setLoading(true);
    api
      .getKnowledge(f)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "ナレッジの取得に失敗しました。"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(filters);
  }, [filters, load]);

  const setField = (key: keyof Filters, value: string) =>
    setFilters((f) => ({ ...f, [key]: value }));

  // 監視中の事例について、再発有無を後日確定する（PATCH）。
  const judge = async (caseId: number, status: "再発なし" | "再発あり") => {
    setPendingId(caseId);
    setToast(null);
    try {
      const res = await api.updateRecurrence(caseId, { status });
      setToast(res.message);
      load(filters);
    } catch (e) {
      setToast(e instanceof ApiError ? e.message : "再発判定の更新に失敗しました。");
    } finally {
      setPendingId(null);
    }
  };

  // フィルタ選択肢は最初の取得結果（全件）から得る。フィルタ適用後も選択肢は保持。
  const [allFilters, setAllFilters] = useState<KnowledgeResponse["filters"] | null>(null);
  useEffect(() => {
    if (data && !allFilters) setAllFilters(data.filters);
  }, [data, allFilters]);
  const opts = allFilters ?? data?.filters;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <BookOpen size={20} className="text-brand-600" />
        <h1 className="text-lg font-bold text-slate-800">承認済みナレッジ一覧</h1>
      </div>

      {toast && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      <Card>
        <CardHeader
          icon={Filter}
          title="フィルタ"
          subtitle="品番・不具合種別・原因・表面処理で絞り込み"
          action={
            <button
              onClick={() => setFilters(EMPTY)}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
            >
              <RotateCcw size={13} /> リセット
            </button>
          }
        />
        <CardBody>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <FilterSelect label="品番" value={filters.product_id} options={opts?.product_id ?? []} onChange={(v) => setField("product_id", v)} />
            <FilterSelect label="不具合種別" value={filters.defect_type} options={opts?.defect_type ?? []} onChange={(v) => setField("defect_type", v)} />
            <FilterSelect label="原因" value={filters.confirmed_cause} options={opts?.confirmed_cause ?? []} onChange={(v) => setField("confirmed_cause", v)} />
            <FilterSelect label="表面処理" value={filters.surface_treatment} options={opts?.surface_treatment ?? []} onChange={(v) => setField("surface_treatment", v)} />
          </div>
        </CardBody>
      </Card>

      {loading ? (
        <LoadingState label="ナレッジを読み込み中…" />
      ) : error ? (
        <ErrorState message={error} />
      ) : !data || data.total === 0 ? (
        <EmptyState message="該当するナレッジがありません。フィルタを変更してください。" />
      ) : (
        <Card>
          <CardHeader
            title="確定事例"
            subtitle="監視中は対策の効果を経過観察中。監視期間(90日)経過後または再発確認時に「再発なし／あり」を確定します"
            action={<Badge className="bg-brand-50 text-brand-700 border-brand-200">{data.total}件</Badge>}
          />
          <CardBody>
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full min-w-[1080px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-[11px] text-slate-400">
                    <th className="px-2 py-2 font-medium">事例ID</th>
                    <th className="px-2 py-2 font-medium">発生日</th>
                    <th className="px-2 py-2 font-medium">品番</th>
                    <th className="px-2 py-2 font-medium">不具合種別</th>
                    <th className="px-2 py-2 font-medium">確定原因</th>
                    <th className="px-2 py-2 font-medium">有効だった対策</th>
                    <th className="px-2 py-2 font-medium">再発状態</th>
                    <th className="px-2 py-2 font-medium">再発判定</th>
                    <th className="px-2 py-2 font-medium">表面処理</th>
                  </tr>
                </thead>
                <tbody>
                  {data.cases.map((c) => (
                    <tr key={c.case_id} className="border-b border-slate-50 align-top hover:bg-slate-50">
                      <td className="tabular px-2 py-2 text-slate-400">#{c.case_id}</td>
                      <td className="px-2 py-2 text-xs text-slate-500">{c.created_at}</td>
                      <td className="px-2 py-2 font-medium text-slate-700">{c.product_id}</td>
                      <td className="px-2 py-2 text-slate-600">{c.defect_type}</td>
                      <td className="px-2 py-2 font-medium text-slate-800">{c.confirmed_cause}</td>
                      <td className="px-2 py-2 text-xs text-slate-500">{c.effective_action}</td>
                      <td className="px-2 py-2">
                        <Badge className={recurrenceBadgeClass(c.recurrence_status)}>
                          {c.recurrence_status}
                        </Badge>
                        {c.recurrence_status === "監視中" ? (
                          <p className="mt-1 text-[10px] text-slate-400">
                            監視 {c.monitoring_days ?? 0}/{c.monitoring_window ?? 90}日
                          </p>
                        ) : (
                          c.recurrence_checked_at && (
                            <p className="mt-1 text-[10px] text-slate-400">確定 {c.recurrence_checked_at}</p>
                          )
                        )}
                      </td>
                      <td className="px-2 py-2">
                        {c.recurrence_status === "監視中" ? (
                          <div className="flex flex-col gap-1">
                            {c.recurrence_eligible && (
                              <span className="text-[10px] font-medium text-emerald-600">監視満了→確定可</span>
                            )}
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={pendingId === c.case_id}
                                onClick={() => judge(c.case_id, "再発なし")}
                                className={cn(
                                  "rounded border px-1.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-50",
                                  "border-emerald-300 text-emerald-700 hover:bg-emerald-50",
                                )}
                              >
                                再発なし
                              </button>
                              <button
                                type="button"
                                disabled={pendingId === c.case_id}
                                onClick={() => judge(c.case_id, "再発あり")}
                                className={cn(
                                  "rounded border px-1.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-50",
                                  "border-red-300 text-red-700 hover:bg-red-50",
                                )}
                              >
                                再発あり
                              </button>
                              {pendingId === c.case_id && (
                                <Loader2 size={13} className="animate-spin text-slate-400" />
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">
                            {c.recurred_lot_id ? `再発: ${c.recurred_lot_id}` : "確定済み"}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-xs text-slate-500">{c.surface_treatment}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
