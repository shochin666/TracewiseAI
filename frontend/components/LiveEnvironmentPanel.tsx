"use client";

import { useEffect, useState } from "react";
import { Activity, AlertTriangle } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { LiveEnvironment, ParamItem } from "@/lib/types";
import { cn, paramStatusClass, PARAM_STATUS_LABEL } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "./Card";
import { Badge } from "./Badge";

// デモ用のポーリング間隔。実機センサー（数分ごと更新）ならもっと長くてよい。
// ここを変えるだけで更新頻度を調整できる（表示にも自動反映される）。
const POLL_INTERVAL_MS = 5000;

function barColor(status: string): string {
  switch (status) {
    case "abnormal":
      return "bg-red-500";
    case "warning":
      return "bg-amber-500";
    case "normal":
      return "bg-emerald-500";
    default:
      return "bg-slate-400";
  }
}

/** センサー1項目のタイル（現在値＋管理範囲内の位置バー）。 */
function SensorTile({ r, flash }: { r: ParamItem; flash: boolean }) {
  const v = r.value ?? 0;
  const pct =
    r.max > r.min ? Math.min(100, Math.max(0, ((v - r.min) / (r.max - r.min)) * 100)) : 50;
  return (
    <div className={cn("rounded-lg border p-3", paramStatusClass(r.status))}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-slate-600">{r.label}</span>
        <Badge className={paramStatusClass(r.status)}>{PARAM_STATUS_LABEL[r.status]}</Badge>
      </div>
      <div className={cn("mt-1 tabular font-bold text-slate-800 transition-opacity duration-200", flash && "opacity-50")}>
        <span className="text-2xl">{r.value ?? "—"}</span>
        <span className="ml-0.5 text-sm text-slate-400">{r.unit}</span>
      </div>
      <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200/70">
        <div className={cn("h-1.5 rounded-full transition-all duration-500", barColor(r.status))} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-[10px] text-slate-400">
        管理範囲 {r.min}〜{r.max}
        {r.unit}
      </p>
    </div>
  );
}

/** 工場環境のリアルタイムモニタ（クライアントで定期ポーリングして再レンダリング）。 */
export function LiveEnvironmentPanel() {
  const [data, setData] = useState<LiveEnvironment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let active = true;
    const tick = () => {
      api
        .getLiveEnvironment()
        .then((d) => {
          if (!active) return;
          setData(d);
          setError(null);
          // 更新を視覚的に知らせる（値を一瞬だけ薄く）
          setFlash(true);
          setTimeout(() => active && setFlash(false), 220);
        })
        .catch((e) => active && setError(e instanceof ApiError ? e.message : "環境値の取得に失敗しました。"));
    };
    tick(); // 初回即時取得
    const id = setInterval(tick, POLL_INTERVAL_MS); // 以降は定期ポーリング
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const intervalSec = Math.round(POLL_INTERVAL_MS / 1000);
  const alerts = data ? data.summary.abnormal + data.summary.warning : 0;

  return (
    <Card>
      <CardHeader
        icon={Activity}
        title={
          <span className="flex items-center gap-2">
            工場環境モニタ
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
              </span>
              LIVE
            </span>
          </span>
        }
        subtitle={`センサー現在値・${intervalSec}秒ごとに自動更新（デモ用の擬似値）`}
        action={
          data && (
            <div className="text-right">
              <p className="text-xs tabular text-slate-500">最終更新 {data.measured_at.slice(11)}</p>
              {alerts > 0 && (
                <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-amber-600">
                  <AlertTriangle size={12} /> 注意/異常 {alerts}件
                </span>
              )}
            </div>
          )
        }
      />
      <CardBody>
        {error && !data && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>
        )}
        {!data && !error && (
          <p className="py-6 text-center text-sm text-slate-400">センサー値を取得中…</p>
        )}
        {data && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {data.readings.map((r) => (
              <SensorTile key={r.key} r={r} flash={flash} />
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
