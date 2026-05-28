import { QrCode, Smartphone, ArrowRight } from "lucide-react";

interface QrScanGuideProps {
  /** 例示するサンプルロットID */
  sampleLotId?: string;
}

/** QRコード読み取りの導線を説明するガイドカード。 */
export function QrScanGuide({ sampleLotId = "LOT-2026-0527-PM-01" }: QrScanGuideProps) {
  return (
    <div className="rounded-xl border border-brand-100 bg-brand-50/60 p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-brand-600 shadow-sm">
          <QrCode size={22} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800">
            通い箱・トレー・バレル札のQRコードをスマホで読み取り
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            QR内のURLから <code className="rounded bg-white px-1 text-brand-700">lot_id</code> を取得し、工程データを自動表示します。
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 overflow-x-auto rounded-lg bg-white/70 px-3 py-2 text-xs text-slate-500">
        <Smartphone size={14} className="shrink-0 text-brand-500" />
        <code className="whitespace-nowrap text-slate-600">
          /defects/new?lot_id={sampleLotId}
        </code>
        <ArrowRight size={14} className="shrink-0 text-slate-300" />
        <span className="whitespace-nowrap">ロット自動表示</span>
      </div>
    </div>
  );
}
