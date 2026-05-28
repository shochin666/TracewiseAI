"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Undo2,
  ShieldCheck,
  BookOpen,
  LayoutDashboard,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { ReportDraft, ApproveResult } from "@/lib/types";
import { WORKFLOW_STEPS } from "@/lib/utils";
import { Stepper } from "@/components/Stepper";
import { Card, CardBody, CardHeader } from "@/components/Card";
import { ReportPreview } from "@/components/ReportPreview";
import { Button, buttonVariants } from "@/components/Button";
import { LoadingState, ErrorState, EmptyState } from "@/components/States";

export default function ReportPage() {
  const params = useParams<{ defectId: string }>();
  const router = useRouter();
  const defectId = Number(params.defectId);

  const [report, setReport] = useState<ReportDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 承認フォーム
  const [cause, setCause] = useState("");
  const [action, setAction] = useState("");
  const [approver, setApprover] = useState("品質保証部");
  const [submitting, setSubmitting] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [approved, setApproved] = useState<ApproveResult | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .getReport(defectId)
      .then((d) => {
        if (!active) return;
        setReport(d);
        setError(null);
        // フォーム初期値を最有力候補から設定
        setCause(d.lead_cause?.name ?? d.cause_candidates[0]?.name ?? "");
        setAction(d.lead_cause?.actions.permanent ?? "");
        if (d.approval.status === "approved") {
          setApproved({ case_id: 0, defect_id: defectId, status: "approved", message: "この不具合は既に承認済みです。" });
        }
      })
      .catch((e) => active && setError(e instanceof ApiError ? e.message : "報告書の取得に失敗しました。"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [defectId]);

  const handleApprove = async () => {
    if (!cause.trim() || !action.trim()) {
      setApproveError("確定原因と有効だった対策を入力してください。");
      return;
    }
    setSubmitting(true);
    setApproveError(null);
    try {
      const res = await api.approveReport(defectId, {
        confirmed_cause: cause.trim(),
        effective_action: action.trim(),
        approver: approver.trim() || "品質保証部",
      });
      setApproved(res);
    } catch (e) {
      setApproveError(e instanceof ApiError ? e.message : "承認に失敗しました。");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingState label="報告書の下書きを生成中…" />;
  if (error) return <ErrorState message={error} hint={`defect_id: ${defectId}`} />;
  if (!report) return <EmptyState message="報告書がありません。" />;

  const isApproved = approved !== null || report.approval.status === "approved";

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-3 flex items-center gap-2 text-xs font-medium text-brand-600">
          <FileText size={15} /> 報告書生成・承認
        </div>
        <Stepper steps={[...WORKFLOW_STEPS]} current={isApproved ? 5 : 4} />
      </div>

      <ReportPreview report={report} />

      {/* 承認パネル */}
      {isApproved ? (
        <Card className="border-emerald-200">
          <CardBody>
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 size={28} />
              </span>
              <div>
                <p className="text-base font-bold text-slate-800">承認済み事例としてナレッジ化しました</p>
                <p className="mt-1 text-sm text-slate-500">
                  {approved?.message ??
                    "承認済みの原因・対策だけが次回以降の原因候補提示に使われます。"}
                  {approved && approved.case_id > 0 && `（事例ID: ${approved.case_id}）`}
                </p>
              </div>
              <div className="mt-1 flex flex-wrap justify-center gap-2.5">
                <Link href="/knowledge" className={buttonVariants("primary", "md")}>
                  <BookOpen size={18} /> ナレッジ一覧で確認
                </Link>
                <Link href="/dashboard" className={buttonVariants("secondary", "md")}>
                  <LayoutDashboard size={18} /> ダッシュボード
                </Link>
              </div>
            </div>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardHeader
            icon={ShieldCheck}
            title="品質担当者による承認"
            subtitle="確定原因と有効だった対策を確認・修正のうえ承認してください。承認するとナレッジに登録されます。"
          />
          <CardBody>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">確定原因</label>
                <select
                  value={cause}
                  onChange={(e) => setCause(e.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-200"
                >
                  {report.cause_candidates.length === 0 && <option value="">（候補なし）</option>}
                  {report.cause_candidates.map((c) => (
                    <option key={c.key} value={c.name}>
                      {c.name}（{c.level}）
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">承認者</label>
                <input
                  value={approver}
                  onChange={(e) => setApprover(e.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-200"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">有効だった対策</label>
                <textarea
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-200"
                />
              </div>
            </div>

            {/* 再発有無は承認時点では判定不能。監視中で登録し後日確定する旨を明示。 */}
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              再発有無は対策実施後の経過観察で判明するため、承認時は
              <span className="font-semibold">「監視中」</span>
              として登録されます。監視期間（90日）の経過後、または再発を確認した時点で、
              <span className="font-semibold">ナレッジ一覧</span>から「再発なし／再発あり」を確定してください。
            </p>

            {approveError && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{approveError}</span>
              </div>
            )}

            <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
              <Button variant="success" size="lg" className="flex-1" onClick={handleApprove} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> 承認中…
                  </>
                ) : (
                  <>
                    <ShieldCheck size={18} /> 承認してナレッジ化
                  </>
                )}
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => router.push(`/analysis/${defectId}`)}
                disabled={submitting}
              >
                <Undo2 size={18} /> 差し戻して再確認
              </Button>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
