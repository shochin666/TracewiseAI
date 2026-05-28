import type { SimilarCase } from "@/lib/types";
import { referenceLevelClass } from "@/lib/utils";
import { Badge } from "./Badge";

interface SimilarCaseTableProps {
  cases: SimilarCase[];
  /** 除外事例（参考度低）として薄く表示するか */
  excluded?: boolean;
  emptyText?: string;
}

/** 類似事例 / 除外事例のテーブル。スマホでは横スクロール。 */
export function SimilarCaseTable({ cases, excluded = false, emptyText }: SimilarCaseTableProps) {
  if (cases.length === 0) {
    return (
      <p className="rounded-lg bg-slate-50 px-3 py-6 text-center text-xs text-slate-400">
        {emptyText ?? "該当する事例はありません。"}
      </p>
    );
  }
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[640px] border-separate border-spacing-y-1.5 px-1 text-sm">
        <thead>
          <tr className="text-left text-[11px] text-slate-400">
            <th className="px-2 font-medium">品番</th>
            <th className="px-2 font-medium">不具合</th>
            <th className="px-2 font-medium">確定原因</th>
            <th className="px-2 font-medium">参考度</th>
            <th className="px-2 font-medium">スコア</th>
            <th className="px-2 font-medium">理由 / 有効だった対策</th>
          </tr>
        </thead>
        <tbody>
          {cases.map((c) => (
            <tr
              key={c.case_id}
              className={excluded ? "opacity-70" : ""}
            >
              <td className="rounded-l-lg bg-slate-50 px-2 py-2 align-top font-medium text-slate-700">
                {c.product_id}
              </td>
              <td className="bg-slate-50 px-2 py-2 align-top text-slate-600">{c.defect_type}</td>
              <td className="bg-slate-50 px-2 py-2 align-top font-medium text-slate-800">
                {c.confirmed_cause}
              </td>
              <td className="bg-slate-50 px-2 py-2 align-top">
                <Badge className={referenceLevelClass(c.reference_level)}>{c.reference_level}</Badge>
              </td>
              <td className="tabular bg-slate-50 px-2 py-2 align-top text-slate-500">
                {c.similarity_score}
              </td>
              <td className="rounded-r-lg bg-slate-50 px-2 py-2 align-top text-xs text-slate-500">
                <p>{c.reason}</p>
                {!excluded && c.effective_action && (
                  <p className="mt-1 text-slate-400">対策: {c.effective_action}</p>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
