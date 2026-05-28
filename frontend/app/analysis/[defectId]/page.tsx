"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Sparkles,
  AlertTriangle,
  FlaskConical,
  Thermometer,
  Gauge,
  Info,
  ListChecks,
  BookMarked,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { AnalysisResult } from "@/lib/types";
import { WORKFLOW_STEPS, STATUS_LABELS, statusBadgeClass, cn } from "@/lib/utils";
import { Stepper } from "@/components/Stepper";
import { Card, CardBody, CardHeader } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { LotInfoCard } from "@/components/LotInfoCard";
import { AutoDataPanel } from "@/components/AutoDataPanel";
import { CauseCandidateCard } from "@/components/CauseCandidateCard";
import { SimilarCaseTable } from "@/components/SimilarCaseTable";
import { ConfirmationChecklist } from "@/components/ConfirmationChecklist";
import { LoadingState, ErrorState, EmptyState } from "@/components/States";

export default function AnalysisPage() {
  const params = useParams<{ defectId: string }>();
  const defectId = Number(params.defectId);
  const [data, setData] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .getAnalysis(defectId)
      .then((d) => active && (setData(d), setError(null)))
      .catch((e) => active && setError(e instanceof ApiError ? e.message : "分析結果の取得に失敗しました。"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [defectId]);

  if (loading) return <LoadingState label="工程データを紐づけて原因候補を分析中…" />;
  if (error) return <ErrorState message={error} hint={`defect_id: ${defectId}`} />;
  if (!data) return <EmptyState message="分析結果がありません。" />;

  const { defect, lot, quality_trend: qt } = data;
  const rate = defect.inspected_count ? Math.round((defect.defect_count / defect.inspected_count) * 1000) / 10 : 0;

  return (
    <div className="space-y-5">
      {/* ステップ */}
      <div>
        <div className="mb-3 flex items-center gap-2 text-xs font-medium text-brand-600">
          <Sparkles size={15} /> AI原因分析
        </div>
        <Stepper steps={[...WORKFLOW_STEPS]} current={2} />
      </div>

      {/* 不具合概要ヘッダ */}
      <Card>
        <CardBody>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-800">{defect.defect_type}</h1>
                <Badge className={statusBadgeClass(defect.status)} dot>
                  {STATUS_LABELS[defect.status]}
                </Badge>
              </div>
              <p className="mt-0.5 text-sm text-slate-500">
                {lot.lot_id} ・ {lot.product?.product_name}（{defect.found_at_process}で発見）
              </p>
            </div>
            <div className="flex gap-4">
              <div className="text-right">
                <p className="text-[11px] text-slate-400">発生数 / 検査数</p>
                <p className="tabular text-base font-bold text-slate-800">
                  {defect.defect_count} / {defect.inspected_count}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-slate-400">不良率</p>
                <p className={cn("tabular text-base font-bold", rate > 1 ? "text-red-600" : "text-slate-800")}>
                  {rate} %
                </p>
              </div>
            </div>
          </div>
          {defect.note && (
            <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">補足: {defect.note}</p>
          )}
        </CardBody>
      </Card>

      {/* ポリシー注記 */}
      <div className="flex items-start gap-2 rounded-xl border border-brand-100 bg-brand-50/60 px-4 py-3 text-xs text-brand-700">
        <Info size={15} className="mt-0.5 shrink-0" />
        <p>{data.policy_note}</p>
      </div>

      {/* ロット/製品情報 + 品質傾向 */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <LotInfoCard lot={lot} />
        </div>
        <Card>
          <CardHeader icon={Gauge} title="品質傾向" subtitle="不良率と過去同種事例" />
          <CardBody>
            <div className="flex items-baseline gap-2">
              <span className={cn("tabular text-3xl font-bold", qt.status === "abnormal" ? "text-red-600" : qt.status === "warning" ? "text-amber-600" : "text-emerald-600")}>
                {qt.defect_rate}
              </span>
              <span className="text-sm text-slate-400">% 不良率</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{qt.judgement}（管理目標 {qt.target_rate}%）</p>
            <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">発生 / 検査</span>
                <span className="tabular font-medium text-slate-700">{qt.defect_count} / {qt.inspected_count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">同種の承認済み事例</span>
                <span className="tabular font-medium text-slate-700">{qt.same_type_knowledge} 件</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">表面処理区分</span>
                <span className="font-medium text-slate-700">{qt.surface_category}</span>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* 工程パラメータ */}
      <AutoDataPanel
        title="工程パラメータ（自動取得）"
        icon={FlaskConical}
        items={data.process_parameters}
        measuredAt={data.process_measured_at}
      />
      {/* 環境パラメータ */}
      <AutoDataPanel
        title="環境パラメータ（自動取得）"
        icon={Thermometer}
        items={data.environment_parameters}
        measuredAt={data.environment_measured_at}
      />

      {/* 原因候補ランキング */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle size={18} className="text-red-500" />
          <h2 className="text-base font-bold text-slate-800">原因候補ランキング</h2>
          <span className="text-xs text-slate-400">（スコア順・断定ではありません）</span>
        </div>
        {data.cause_candidates.length === 0 ? (
          <EmptyState message="明確な原因候補は抽出されませんでした。現場での追加確認が必要です。" />
        ) : (
          <div className="space-y-3">
            {data.cause_candidates.map((c) => (
              <CauseCandidateCard key={c.key} candidate={c} />
            ))}
          </div>
        )}
      </section>

      {/* 類似事例 / 除外事例 */}
      <div className="grid grid-cols-1 gap-5">
        <Card>
          <CardHeader
            icon={BookMarked}
            title="参考にした類似事例"
            subtitle="承認済みナレッジから条件が近い事例を抽出"
            action={<Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">{data.similar_cases.length}件</Badge>}
          />
          <CardBody>
            <SimilarCaseTable cases={data.similar_cases} emptyText="参考にできる類似事例はまだありません。" />
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            icon={BookMarked}
            title="参考度を下げた・除外した事例"
            subtitle="表面処理・材質・工程が異なるため参考度が低い事例"
            action={<Badge className="bg-slate-100 text-slate-500 border-slate-200">{data.excluded_cases.length}件</Badge>}
          />
          <CardBody>
            <SimilarCaseTable cases={data.excluded_cases} excluded emptyText="除外した事例はありません。" />
          </CardBody>
        </Card>
      </div>

      {/* 確認結果入力 */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <ListChecks size={18} className="text-brand-600" />
          <h2 className="text-base font-bold text-slate-800">優先確認項目と確認結果</h2>
        </div>
        {data.check_items.length === 0 ? (
          <EmptyState message="確認項目はありません。" />
        ) : (
          <ConfirmationChecklist
            defectId={defectId}
            checkItems={data.check_items}
            existing={data.investigation_results}
          />
        )}
      </section>
    </div>
  );
}
