"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  ClipboardList,
  Library,
  ShieldCheck,
  Clock3,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { DashboardSummary } from "@/lib/types";
import { STATUS_LABELS, statusBadgeClass } from "@/lib/utils";
import { StatCard } from "@/components/StatCard";
import { Card, CardBody, CardHeader } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { DashboardCharts } from "@/components/DashboardCharts";
import { LiveEnvironmentPanel } from "@/components/LiveEnvironmentPanel";
import { LoadingState, ErrorState } from "@/components/States";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .getDashboard()
      .then((d) => active && (setData(d), setError(null)))
      .catch((e) => active && setError(e instanceof ApiError ? e.message : "集計の取得に失敗しました。"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <LoadingState label="集計データを読み込み中…" />;
  if (error) return <ErrorState message={error} hint="バックエンドAPIが起動しているか確認してください。" />;
  if (!data) return null;

  const t = data.totals;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <LayoutDashboard size={20} className="text-brand-600" />
        <h1 className="text-lg font-bold text-slate-800">ダッシュボード</h1>
      </div>

      {/* 統計カード */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="不具合 総件数" value={t.defects} unit="件" icon={ClipboardList} accent="brand" />
        <StatCard label="承認済みナレッジ" value={t.knowledge_cases} unit="件" icon={Library} accent="emerald" sub="候補提示の補正に活用" />
        <StatCard label="承認済み" value={t.approved_defects} unit="件" icon={ShieldCheck} accent="indigo" />
        <StatCard label="未承認" value={t.unapproved_defects} unit="件" icon={Clock3} accent="amber" sub="対応中の不具合" />
      </div>

      {/* 工場環境のリアルタイムモニタ（クライアントで定期ポーリング） */}
      <LiveEnvironmentPanel />

      {/* グラフ */}
      <DashboardCharts summary={data} />

      {/* 直近の不具合一覧 */}
      <Card>
        <CardHeader icon={Clock3} title="直近の不具合一覧" subtitle="クリックで原因分析・報告書へ" />
        <CardBody>
          {data.recent_defects.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">不具合はまだありません。</p>
          ) : (
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-[11px] text-slate-400">
                    <th className="px-2 py-2 font-medium">ロット</th>
                    <th className="px-2 py-2 font-medium">不具合種別</th>
                    <th className="px-2 py-2 font-medium">発生/検査</th>
                    <th className="px-2 py-2 font-medium">不良率</th>
                    <th className="px-2 py-2 font-medium">状態</th>
                    <th className="px-2 py-2 font-medium">登録日時</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_defects.map((d) => (
                    <tr key={d.defect_id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-2 py-2">
                        <Link href={`/defects/${d.defect_id}`} className="font-medium text-brand-700 hover:underline">
                          {d.lot_id}
                        </Link>
                      </td>
                      <td className="px-2 py-2 text-slate-600">{d.defect_type}</td>
                      <td className="tabular px-2 py-2 text-slate-500">
                        {d.defect_count} / {d.inspected_count}
                      </td>
                      <td className="tabular px-2 py-2 text-slate-600">{d.defect_rate}%</td>
                      <td className="px-2 py-2">
                        <Badge className={statusBadgeClass(d.status)}>{STATUS_LABELS[d.status]}</Badge>
                      </td>
                      <td className="px-2 py-2 text-xs text-slate-400">{d.created_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
