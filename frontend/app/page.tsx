import Link from "next/link";
import {
  QrCode,
  ClipboardList,
  DatabaseZap,
  Sparkles,
  CheckSquare,
  FileText,
  Library,
  ArrowRight,
  LayoutDashboard,
  BookOpen,
  Play,
  ShieldCheck,
} from "lucide-react";
import { buttonVariants } from "@/components/Button";
import { QrScanGuide } from "@/components/QrScanGuide";
import { Card } from "@/components/Card";

const SAMPLE_LOT = "LOT-2026-0527-PM-01";

const FLOW = [
  { icon: QrCode, title: "QRコード読み取り", desc: "通い箱・トレー・バレル札のQRをスマホで読む" },
  { icon: ClipboardList, title: "不具合登録", desc: "種別・発生数・検査数・暫定対応など事実のみ入力" },
  { icon: DatabaseZap, title: "工程データ自動紐づけ", desc: "lot_idから工程・環境パラメータを自動取得" },
  { icon: Sparkles, title: "AI原因候補提示", desc: "ルール＋ナレッジで原因候補と根拠を提示" },
  { icon: CheckSquare, title: "確認結果入力", desc: "優先確認項目を異常あり/なしで選択入力" },
  { icon: FileText, title: "報告書生成", desc: "原因候補・対策・根拠を含む下書きを自動生成" },
  { icon: Library, title: "ナレッジ蓄積", desc: "承認済み事例だけを蓄積し候補提示を補正" },
];

const SAMPLE_LOTS = [
  { id: "LOT-2026-0527-PM-01", note: "六角ボルト M8×25 / 亜鉛メッキ（白っぽい変色のデモ向け）", star: true },
  { id: "LOT-2026-0527-AM-01", note: "六角ボルト M8×25 / 亜鉛メッキ" },
  { id: "LOT-2026-0528-AM-01", note: "小ねじ M4×12 / 亜鉛メッキ" },
  { id: "LOT-2026-0528-PM-01", note: "フランジボルト M8×20 / 黒染め" },
  { id: "LOT-2026-0529-AM-01", note: "六角ボルト M8×25 / 亜鉛ニッケルメッキ" },
];

export default function HomePage() {
  return (
    <div className="space-y-8">
      {/* ヒーロー */}
      <section className="overflow-hidden rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white sm:p-8">
        <div className="flex items-center gap-2 text-brand-100">
          <Sparkles size={16} />
          <span className="text-xs font-medium">製造業向けデモ — ねじ亜鉛メッキ工程</span>
        </div>
        <h1 className="mt-3 text-2xl font-bold leading-tight sm:text-3xl">
          ねじメッキ工程 不具合登録・AI原因分析システム
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-brand-50 sm:text-base">
          QRコードでロットを特定し、工程データから原因候補と報告書を自動生成します。
          現場は「見た事実」だけを入力。AIは原因を断定せず、原因候補と確認項目を提示します。
        </p>
        <div className="mt-5 flex flex-wrap gap-2.5">
          <Link href={`/defects/new?lot_id=${SAMPLE_LOT}`} className={buttonVariants("secondary", "md")}>
            <Play size={18} /> デモを開始
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/30 bg-white/10 px-5 text-sm font-medium text-white transition-colors hover:bg-white/20"
          >
            <LayoutDashboard size={18} /> ダッシュボード
          </Link>
          <Link
            href="/knowledge"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/30 bg-white/10 px-5 text-sm font-medium text-white transition-colors hover:bg-white/20"
          >
            <BookOpen size={18} /> ナレッジ一覧
          </Link>
        </div>
      </section>

      <QrScanGuide sampleLotId={SAMPLE_LOT} />

      {/* 処理の流れ（7ステップ） */}
      <section>
        <h2 className="mb-3 text-base font-bold text-slate-800">処理の流れ</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FLOW.map((step, i) => {
            const Icon = step.icon;
            return (
              <Card key={step.title} className="p-4 transition-shadow hover:shadow-cardhover">
                <div className="flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <Icon size={18} />
                  </span>
                  <span className="tabular text-xs font-bold text-slate-300">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="mt-2.5 text-sm font-semibold text-slate-800">{step.title}</h3>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{step.desc}</p>
              </Card>
            );
          })}
          {/* 8枠目: ポリシー */}
          <Card className="flex flex-col justify-center bg-slate-50 p-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <ShieldCheck size={18} />
            </span>
            <p className="mt-2.5 text-xs leading-relaxed text-slate-600">
              AIは真因を断定しません。<br />
              最終原因は<strong className="text-slate-800">品質担当者の承認</strong>で確定し、
              承認済み事例だけがナレッジ化されます。
            </p>
          </Card>
        </div>
      </section>

      {/* サンプルロット */}
      <section>
        <h2 className="mb-3 text-base font-bold text-slate-800">サンプルロット（QRの代わりにクリックで開始）</h2>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {SAMPLE_LOTS.map((lot) => (
            <Link
              key={lot.id}
              href={`/defects/new?lot_id=${lot.id}`}
              className="group flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 transition-all hover:border-brand-300 hover:shadow-cardhover"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 group-hover:bg-brand-50 group-hover:text-brand-600">
                  <QrCode size={18} />
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <span className="truncate">{lot.id}</span>
                    {lot.star && (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        おすすめ
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-slate-400">{lot.note}</p>
                </div>
              </div>
              <ArrowRight size={18} className="shrink-0 text-slate-300 group-hover:text-brand-500" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
