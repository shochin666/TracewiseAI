import { Award, ChevronRight, ClipboardCheck, Lightbulb, BookMarked } from "lucide-react";
import type { CauseCandidate } from "@/lib/types";
import {
  cn,
  levelClass,
  scoreBarClass,
  paramStatusClass,
  PARAM_STATUS_LABEL,
} from "@/lib/utils";
import { Badge } from "./Badge";

interface CauseCandidateCardProps {
  candidate: CauseCandidate;
}

/** 原因候補1件をランキングカードとして表示する。 */
export function CauseCandidateCard({ candidate: c }: CauseCandidateCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-white shadow-card",
        c.is_lead ? "border-red-300 ring-1 ring-red-200" : "border-slate-200",
      )}
    >
      {c.is_lead && (
        <div className="flex items-center gap-1.5 bg-red-500 px-4 py-1.5 text-xs font-semibold text-white">
          <Award size={14} /> 最有力候補（優先確認を推奨）
        </div>
      )}
      <div className="p-4">
        {/* ヘッダ：順位・名称・レベル */}
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base font-bold",
              c.is_lead ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500",
            )}
          >
            {c.rank}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-slate-800">{c.name}</h3>
              <Badge className={levelClass(c.level)}>可能性 {c.level}</Badge>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">{c.summary}</p>
          </div>
        </div>

        {/* スコアバー */}
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-slate-400">原因候補スコア</span>
            <span className="tabular font-semibold text-slate-700">{c.score} pt</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={cn("h-full rounded-full transition-all", scoreBarClass(c.level))}
              style={{ width: `${c.score_display}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-slate-400">{c.confidence}</p>
        </div>

        {/* 根拠 */}
        {c.evidences.length > 0 && (
          <div className="mt-3">
            <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-slate-500">
              <Lightbulb size={13} /> 根拠
            </p>
            <ul className="space-y-1">
              {c.evidences.map((ev, i) => (
                <li key={i} className="flex gap-1.5 text-xs text-slate-600">
                  <ChevronRight size={13} className="mt-0.5 shrink-0 text-slate-300" />
                  <span>{ev}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 関連パラメータ */}
        {c.related_params.length > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 text-[11px] font-semibold text-slate-500">関連パラメータ</p>
            <div className="flex flex-wrap gap-1.5">
              {c.related_params.map((p) => (
                <Badge key={p.key} className={paramStatusClass(p.status)}>
                  {p.label}: {p.value ?? "—"}
                  {p.unit}（{PARAM_STATUS_LABEL[p.status]}）
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* 参考にした事例 */}
        {c.reference_cases.length > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold text-slate-500">
              <BookMarked size={13} /> 参考にした承認済み事例（{c.reference_cases.length}件）
            </p>
            <div className="flex flex-wrap gap-1.5">
              {c.reference_cases.map((rc) => (
                <span
                  key={rc.case_id}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-500"
                >
                  {rc.product_id} / {rc.defect_type} / {rc.confirmed_cause}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 確認すべき項目 */}
        <div className="mt-3 rounded-lg bg-brand-50/60 p-3">
          <p className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold text-brand-700">
            <ClipboardCheck size={13} /> 確認すべき項目
          </p>
          <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {c.check_items.map((item) => (
              <li key={item} className="flex gap-1.5 text-xs text-slate-600">
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-brand-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
