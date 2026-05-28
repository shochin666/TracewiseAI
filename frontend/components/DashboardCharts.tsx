"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import { TrendingUp, PieChart, Boxes, Activity } from "lucide-react";
import type { DashboardSummary } from "@/lib/types";
import { Card, CardBody, CardHeader } from "./Card";

const BLUE = "#2563eb";
const COLORS = ["#2563eb", "#0ea5e9", "#6366f1", "#f59e0b", "#ef4444", "#10b981", "#64748b"];

const axisProps = {
  tick: { fontSize: 11, fill: "#64748b" },
  axisLine: { stroke: "#e2e8f0" },
  tickLine: false,
};

function ChartCard({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: typeof TrendingUp;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} icon={icon} />
      <CardBody>
        <div className="h-56 w-full">{children}</div>
      </CardBody>
    </Card>
  );
}

export function DashboardCharts({ summary }: { summary: DashboardSummary }) {
  const trend = summary.defect_trend.map((d) => ({ ...d, label: d.date.slice(5) }));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* 不具合件数の推移 */}
      <ChartCard title="不具合件数の推移" subtitle="登録された不具合の日次件数" icon={TrendingUp}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trend} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis allowDecimals={false} {...axisProps} />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
              labelFormatter={(l) => `日付: ${l}`}
              formatter={(v: number) => [`${v} 件`, "不具合件数"]}
            />
            <Line
              type="linear"
              dataKey="count"
              stroke={BLUE}
              strokeWidth={2.5}
              dot={{ r: 4, fill: BLUE }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 原因別件数 */}
      <ChartCard title="原因別件数" subtitle="承認済みナレッジの確定原因の分布" icon={PieChart}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={summary.cause_breakdown} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="cause" interval={0} {...axisProps} angle={-12} textAnchor="end" height={48} />
            <YAxis allowDecimals={false} {...axisProps} />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
              formatter={(v: number) => [`${v} 件`, "件数"]}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {summary.cause_breakdown.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 品番別不具合件数 */}
      <ChartCard title="品番別不具合件数" subtitle="不具合が登録された品番の分布" icon={Boxes}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={summary.product_breakdown} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="product_id" interval={0} {...axisProps} angle={-12} textAnchor="end" height={48} />
            <YAxis allowDecimals={false} {...axisProps} />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
              formatter={(v: number, _n, p: any) => [`${v} 件`, p?.payload?.product_name ?? "件数"]}
            />
            <Bar dataKey="count" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 工程パラメータ異常と不具合の関係 */}
      <ChartCard
        title="工程パラメータ異常と不具合の関係"
        subtitle="不具合ロットで管理基準を逸脱していたパラメータの件数"
        icon={Activity}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={summary.param_defect_relation}
            layout="vertical"
            margin={{ top: 4, right: 16, left: 24, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
            <XAxis type="number" allowDecimals={false} {...axisProps} />
            <YAxis type="category" dataKey="label" width={92} {...axisProps} />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
              formatter={(v: number) => [`${v} 件`, "異常を伴う不具合"]}
            />
            <Bar dataKey="abnormal_defect_count" fill="#f59e0b" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
