import {
  FileText,
  AlertTriangle,
  Target,
  Wrench,
  ShieldCheck,
  ClipboardList,
  BookMarked,
} from "lucide-react";
import type { ReportDraft } from "@/lib/types";
import { cn, resultBadgeClass, levelClass } from "@/lib/utils";
import { Badge } from "./Badge";
import { SimilarCaseTable } from "./SimilarCaseTable";

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof FileText;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-slate-100 px-5 py-4 first:border-t-0">
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
        <Icon size={15} className="text-brand-600" />
        {title}
      </h3>
      {children}
    </section>
  );
}

function KV({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1 text-sm">
      <span className="shrink-0 text-slate-400">{label}</span>
      <span className="text-right font-medium text-slate-700">{value ?? "—"}</span>
    </div>
  );
}

interface ReportPreviewProps {
  report: ReportDraft;
}

/** AI風に生成された報告書下書きを表示する（承認操作は親ページが持つ）。 */
export function ReportPreview({ report }: ReportPreviewProps) {
  const r = report;
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
      {/* タイトル */}
      <div className="bg-slate-800 px-5 py-4 text-white">
        <div className="flex items-center gap-2">
          <FileText size={18} />
          <span className="rounded bg-amber-400/90 px-1.5 py-0.5 text-[10px] font-bold text-amber-950">
            下書き
          </span>
        </div>
        <h2 className="mt-1.5 text-base font-bold">{r.title}</h2>
        <p className="mt-0.5 text-xs text-slate-300">生成日時: {r.generated_at}</p>
      </div>

      {/* AI生成本文 */}
      <Section title="報告書 本文（自動生成）" icon={FileText}>
        <div className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
          {r.body_text}
        </div>
      </Section>

      {/* 不具合概要 */}
      <Section title="不具合概要" icon={AlertTriangle}>
        <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
          <div>
            <KV label="対象ロット" value={r.summary.lot_id} />
            <KV label="不具合種別" value={r.summary.defect_type} />
            <KV label="発見場所" value={r.summary.found_at_process} />
          </div>
          <div>
            <KV label="発生数 / 検査数" value={`${r.occurrence.defect_count} / ${r.occurrence.inspected_count}`} />
            <KV label="不良率" value={`${r.occurrence.defect_rate} %`} />
            <KV label="対象製品" value={`${r.target_product.product_name ?? ""}（${r.target_product.product_id ?? ""}）`} />
          </div>
        </div>
        {r.summary.note && (
          <p className="mt-2 rounded bg-slate-50 px-3 py-2 text-xs text-slate-500">
            補足: {r.summary.note}
          </p>
        )}
      </Section>

      {/* 異常パラメータ */}
      <Section title="自動取得された異常パラメータ" icon={AlertTriangle}>
        {r.abnormal_parameters.length === 0 ? (
          <p className="text-xs text-slate-400">管理基準を逸脱するパラメータはありません。</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {r.abnormal_parameters.map((p) => (
              <Badge
                key={p.key}
                className={
                  p.status === "abnormal"
                    ? "bg-red-100 text-red-700 border-red-200"
                    : "bg-amber-100 text-amber-700 border-amber-200"
                }
              >
                {p.label}: {p.value}
                {p.unit}
              </Badge>
            ))}
          </div>
        )}
      </Section>

      {/* 推定原因候補 */}
      <Section title="推定原因候補（断定ではありません）" icon={Target}>
        <div className="space-y-1.5">
          {r.cause_candidates.map((c) => (
            <div
              key={c.key}
              className={cn(
                "flex items-center justify-between rounded-lg border px-3 py-2",
                c.is_lead ? "border-red-200 bg-red-50/60" : "border-slate-200",
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400">{c.rank}.</span>
                <span className="text-sm font-medium text-slate-700">{c.name}</span>
                {c.is_lead && (
                  <Badge className="bg-red-100 text-red-700 border-red-200">最有力</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge className={levelClass(c.level)}>{c.level}</Badge>
                <span className="tabular text-xs text-slate-400">{c.score}pt</span>
              </div>
            </div>
          ))}
        </div>
        {r.lead_cause && (
          <div className="mt-3">
            <p className="mb-1 text-xs font-semibold text-slate-500">最有力候補の根拠</p>
            <ul className="space-y-1">
              {r.evidence.map((e, i) => (
                <li key={i} className="flex gap-1.5 text-xs text-slate-600">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-red-400" />
                  {e}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      {/* 確認結果 */}
      <Section title="確認結果" icon={ClipboardList}>
        {r.investigation_summary.total === 0 ? (
          <p className="text-xs text-slate-400">確認結果は未入力です。</p>
        ) : (
          <div className="space-y-1.5">
            {r.investigation_summary.items.map((it, i) => (
              <div key={i} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate text-slate-600">{it.check_item}</span>
                <div className="flex shrink-0 items-center gap-2">
                  {it.note && <span className="text-[11px] text-slate-400">{it.note}</span>}
                  <Badge className={resultBadgeClass(it.result)}>{it.result_label}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* 対策 */}
      <Section title="暫定対策" icon={Wrench}>
        <p className="text-sm text-slate-700">{r.temporary_action}</p>
      </Section>
      <Section title="恒久対策案" icon={Wrench}>
        <ul className="space-y-1">
          {r.permanent_action_plan.map((a, i) => (
            <li key={i} className="flex gap-1.5 text-sm text-slate-700">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-400" />
              {a}
            </li>
          ))}
        </ul>
        {r.action_cautions && r.action_cautions.length > 0 && (
          <div className="mt-3 space-y-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-red-700">
              <AlertTriangle size={13} /> 過去に再発した対策（そのままの踏襲は要注意）
            </p>
            {r.action_cautions.map((c, i) => (
              <p key={i} className="flex gap-1.5 text-xs text-red-700">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-red-400" />
                {c}
              </p>
            ))}
          </div>
        )}
      </Section>
      <Section title="再発防止案" icon={ShieldCheck}>
        <ul className="space-y-1">
          {r.prevention_plan.map((a, i) => (
            <li key={i} className="flex gap-1.5 text-sm text-slate-700">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-400" />
              {a}
            </li>
          ))}
        </ul>
      </Section>

      {/* 参考事例 / 除外事例 */}
      <Section title="参考にした過去事例" icon={BookMarked}>
        <SimilarCaseTable cases={r.reference_cases} emptyText="参考事例はありません。" />
      </Section>
      {r.excluded_cases.length > 0 && (
        <Section title="参考度を下げた・除外した事例" icon={BookMarked}>
          <SimilarCaseTable cases={r.excluded_cases} excluded />
        </Section>
      )}

      {/* 承認欄 */}
      <Section title="品質担当者 承認欄" icon={ShieldCheck}>
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-500">
          {r.approval.status === "approved" ? (
            <p className="font-medium text-emerald-600">承認済み — ナレッジに登録されました。</p>
          ) : (
            <p>{r.policy_note}</p>
          )}
        </div>
      </Section>
    </div>
  );
}
