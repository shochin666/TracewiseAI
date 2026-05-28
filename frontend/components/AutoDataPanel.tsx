import type { LucideIcon } from "lucide-react";
import type { ParamItem } from "@/lib/types";
import { cn, paramStatusClass, PARAM_STATUS_LABEL } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "./Card";
import { Badge } from "./Badge";

interface AutoDataPanelProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  items: ParamItem[];
  measuredAt?: string;
}

/** 値が管理範囲[min,max]のどこにあるかを示すレンジバー。 */
function RangeBar({ p }: { p: ParamItem }) {
  let pct = 50;
  if (p.value != null && p.max > p.min) {
    pct = ((p.value - p.min) / (p.max - p.min)) * 100;
  }
  const clamped = Math.max(0, Math.min(100, pct));
  const markerColor =
    p.status === "abnormal"
      ? "bg-red-500"
      : p.status === "warning"
        ? "bg-amber-500"
        : "bg-emerald-500";
  return (
    <div className="mt-1.5">
      <div className="relative h-1.5 w-full rounded-full bg-slate-200">
        {/* 正常域（トラック全体が管理範囲） */}
        <div className="absolute inset-0 rounded-full bg-emerald-100" />
        <div
          className={cn(
            "absolute top-1/2 h-3 w-3 -translate-y-1/2 -translate-x-1/2 rounded-full ring-2 ring-white",
            markerColor,
          )}
          style={{ left: `${clamped}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        <span>{p.min}</span>
        <span>管理範囲</span>
        <span>{p.max}</span>
      </div>
    </div>
  );
}

function ParamRow({ p }: { p: ParamItem }) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        p.status === "abnormal"
          ? "border-red-200 bg-red-50/40"
          : p.status === "warning"
            ? "border-amber-200 bg-amber-50/40"
            : "border-slate-200 bg-white",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-600">{p.label}</p>
          <p className="tabular mt-0.5 text-lg font-bold text-slate-800">
            {p.value ?? "—"}
            <span className="ml-0.5 text-xs font-normal text-slate-400">{p.unit}</span>
          </p>
        </div>
        <Badge className={paramStatusClass(p.status)}>{PARAM_STATUS_LABEL[p.status]}</Badge>
      </div>
      <RangeBar p={p} />
      {p.note && (
        <p
          className={cn(
            "mt-1.5 text-[11px]",
            p.status === "abnormal"
              ? "text-red-600"
              : p.status === "warning"
                ? "text-amber-600"
                : "text-slate-400",
          )}
        >
          {p.note}
        </p>
      )}
    </div>
  );
}

/** 工程パラメータ / 環境パラメータの自動取得値を一覧表示する。 */
export function AutoDataPanel({ title, subtitle, icon, items, measuredAt }: AutoDataPanelProps) {
  const abnormalCount = items.filter((i) => i.status === "abnormal").length;
  const warnCount = items.filter((i) => i.status === "warning").length;
  return (
    <Card>
      <CardHeader
        icon={icon}
        title={title}
        subtitle={subtitle ?? (measuredAt ? `測定時刻: ${measuredAt}` : undefined)}
        action={
          (abnormalCount > 0 || warnCount > 0) && (
            <div className="flex gap-1.5">
              {abnormalCount > 0 && (
                <Badge className="bg-red-100 text-red-700 border-red-200">異常 {abnormalCount}</Badge>
              )}
              {warnCount > 0 && (
                <Badge className="bg-amber-100 text-amber-700 border-amber-200">注意 {warnCount}</Badge>
              )}
            </div>
          )
        }
      />
      <CardBody>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((p) => (
            <ParamRow key={p.key} p={p} />
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
