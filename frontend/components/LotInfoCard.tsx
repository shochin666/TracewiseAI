import { Boxes, PackageSearch } from "lucide-react";
import type { Lot } from "@/lib/types";
import { Card, CardBody, CardHeader } from "./Card";
import { Badge } from "./Badge";

interface LotInfoCardProps {
  lot: Lot;
}

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium text-slate-400">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-slate-800">
        {value ?? <span className="text-slate-300">—</span>}
      </dd>
    </div>
  );
}

/** QRから取得したロット情報と製品情報をまとめて自動表示する。 */
export function LotInfoCard({ lot }: LotInfoCardProps) {
  const p = lot.product;
  return (
    <Card>
      <CardHeader
        icon={PackageSearch}
        title="ロット情報（QRから自動取得）"
        subtitle="現場担当者の入力は不要。品番・工程・設備・時刻を自動表示します。"
        action={
          <Badge className="bg-brand-50 text-brand-700 border-brand-200" dot>
            自動表示
          </Badge>
        }
      />
      <CardBody>
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
          <Boxes size={16} className="text-brand-600" />
          <span className="tabular text-base font-bold text-slate-800">{lot.lot_id}</span>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          <Field label="品番" value={lot.product_id} />
          <Field label="製品名" value={p?.product_name} />
          <Field label="ねじ種別" value={p?.screw_type} />
          <Field label="材質" value={p?.material} />
          <Field label="表面処理" value={p?.surface_treatment} />
          <Field label="処理方式" value={p?.plating_type} />
          <Field label="工程" value={lot.process_name} />
          <Field label="設備ID" value={lot.equipment_id} />
          <Field label="投入数量" value={lot.quantity != null ? `${lot.quantity.toLocaleString()} 個` : undefined} />
          <Field label="処理開始時刻" value={lot.start_time} />
          <Field label="処理終了時刻" value={lot.end_time} />
          <Field label="作業指示" value={lot.work_order_id} />
        </dl>
      </CardBody>
    </Card>
  );
}
