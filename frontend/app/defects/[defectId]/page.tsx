"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ClipboardList, ArrowRight, Sparkles, FileText } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { Defect } from "@/lib/types";
import { STATUS_LABELS, statusBadgeClass, defectRate } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { buttonVariants } from "@/components/Button";
import { LoadingState, ErrorState } from "@/components/States";

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-slate-50 py-2 text-sm last:border-0">
      <span className="text-slate-400">{label}</span>
      <span className="text-right font-medium text-slate-700">{value ?? "—"}</span>
    </div>
  );
}

export default function DefectDetailPage() {
  const params = useParams<{ defectId: string }>();
  const defectId = Number(params.defectId);
  const [defect, setDefect] = useState<Defect | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .getDefect(defectId)
      .then((d) => active && (setDefect(d), setError(null)))
      .catch((e) => active && setError(e instanceof ApiError ? e.message : "不具合の取得に失敗しました。"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [defectId]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} hint={`defect_id: ${defectId}`} />;
  if (!defect) return null;

  // 状態に応じた次工程への導線
  const next =
    defect.status === "report_generated" || defect.status === "approved"
      ? { href: `/reports/${defectId}`, label: "報告書を見る", icon: FileText }
      : defect.status === "investigated"
        ? { href: `/reports/${defectId}`, label: "報告書を生成する", icon: FileText }
        : { href: `/analysis/${defectId}`, label: "原因分析へ進む", icon: Sparkles };
  const NextIcon = next.icon;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center gap-2">
        <ClipboardList size={20} className="text-brand-600" />
        <h1 className="text-lg font-bold text-slate-800">不具合 #{defect.defect_id}</h1>
        <Badge className={statusBadgeClass(defect.status)} dot>
          {STATUS_LABELS[defect.status]}
        </Badge>
      </div>

      <Card>
        <CardHeader title={defect.defect_type} subtitle={`ロット ${defect.lot_id}`} />
        <CardBody>
          <Row label="ロットID" value={defect.lot_id} />
          <Row label="不具合種別" value={defect.defect_type} />
          <Row label="発生数 / 検査数" value={`${defect.defect_count} / ${defect.inspected_count}`} />
          <Row label="不良率" value={`${defectRate(defect.defect_count, defect.inspected_count)} %`} />
          <Row label="発見場所" value={defect.found_at_process} />
          <Row label="暫定対応" value={defect.temporary_action} />
          <Row label="補足メモ" value={defect.note || "—"} />
          <Row label="登録日時" value={defect.created_at} />
        </CardBody>
      </Card>

      <Link href={next.href} className={buttonVariants("primary", "lg") + " w-full"}>
        <NextIcon size={18} /> {next.label} <ArrowRight size={18} />
      </Link>
    </div>
  );
}
