// 共通ユーティリティ・UI定数・ラベル/色マッピング。
import type {
  CauseLevel,
  DefectStatus,
  InvestigationResultValue,
  ParamStatus,
} from "./types";

/** Tailwindのクラス名を結合する（falsyは除外）。 */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

/** 不良率(%)を計算する。 */
export function defectRate(count: number, inspected: number): number {
  if (!inspected) return 0;
  return Math.round((count / inspected) * 1000) / 10;
}

// --- 不具合登録フォームの選択肢（要件4.2） -------------------------------
export const DEFECT_TYPES = [
  "白っぽい変色",
  "メッキムラ",
  "白錆",
  "密着不良",
  "黒ずみ",
  "膜厚不足",
] as const;

export const FOUND_AT_OPTIONS = ["外観検査", "工程内検査", "出荷検査"] as const;

// --- 作業フローのステップ（登録〜承認） -----------------------------------
export const WORKFLOW_STEPS = [
  "不具合登録",
  "原因分析",
  "確認結果入力",
  "報告書生成",
  "承認・ナレッジ化",
] as const;

export const TEMP_ACTION_OPTIONS = [
  "対象ロット隔離",
  "再検査依頼",
  "ライン確認依頼",
  "保留",
] as const;

// --- ステータス（defects.status） ----------------------------------------
export const STATUS_LABELS: Record<DefectStatus, string> = {
  registered: "登録済み",
  analyzing: "分析中",
  investigated: "確認入力済み",
  report_generated: "報告書生成済み",
  approved: "承認済み",
};

export function statusBadgeClass(status: DefectStatus | string): string {
  switch (status) {
    case "approved":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "report_generated":
      return "bg-brand-100 text-brand-700 border-brand-200";
    case "investigated":
      return "bg-indigo-100 text-indigo-700 border-indigo-200";
    case "analyzing":
      return "bg-amber-100 text-amber-700 border-amber-200";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

// --- パラメータ状態の色 ----------------------------------------------------
export function paramStatusClass(status: ParamStatus): string {
  switch (status) {
    case "abnormal":
      return "bg-red-50 text-red-700 border-red-200";
    case "warning":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "normal":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    default:
      return "bg-slate-50 text-slate-500 border-slate-200";
  }
}

export const PARAM_STATUS_LABEL: Record<ParamStatus, string> = {
  abnormal: "異常",
  warning: "注意",
  normal: "正常",
  unknown: "—",
};

// --- 原因候補レベルの色 ----------------------------------------------------
export function levelClass(level: CauseLevel): string {
  switch (level) {
    case "高":
      return "bg-red-100 text-red-700 border-red-200";
    case "中":
      return "bg-amber-100 text-amber-700 border-amber-200";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

/** スコアバーの色（高いほど濃い赤寄り）。 */
export function scoreBarClass(level: CauseLevel): string {
  switch (level) {
    case "高":
      return "bg-red-500";
    case "中":
      return "bg-amber-500";
    default:
      return "bg-slate-400";
  }
}

// --- 確認結果の選択肢・ラベル・色 ----------------------------------------
// 現場が押すのは「異常あり / 異常なし」の2択のみ。
// 既定は「異常なし」。現場は異常があった項目だけ「異常あり」に切り替える。
export const INVESTIGATION_OPTIONS: {
  value: InvestigationResultValue;
  label: string;
}[] = [
  { value: "abnormal", label: "異常あり" },
  { value: "normal", label: "異常なし" },
];

export const RESULT_LABELS: Record<InvestigationResultValue, string> = {
  abnormal: "異常あり",
  normal: "異常なし",
  unchecked: "未確認",
  not_applicable: "該当なし",
};

export function resultBadgeClass(result: InvestigationResultValue): string {
  switch (result) {
    case "abnormal":
      return "bg-red-100 text-red-700 border-red-200";
    case "normal":
      // 異常なしは背景を白く（緑のボーダーと文字で示す）。異常ありだけ色で目立たせる。
      return "bg-white text-emerald-700 border-emerald-200";
    case "not_applicable":
      return "bg-slate-100 text-slate-500 border-slate-200";
    default:
      return "bg-amber-100 text-amber-700 border-amber-200";
  }
}

/** 参考度ラベルの色。 */
export function referenceLevelClass(level: CauseLevel): string {
  switch (level) {
    case "高":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "中":
      return "bg-brand-100 text-brand-700 border-brand-200";
    default:
      return "bg-slate-100 text-slate-500 border-slate-200";
  }
}

// --- 再発ライフサイクルの色 ----------------------------------------------
// 監視中=経過観察中（アンバー）／再発なし=検証済み（緑）／再発あり=対策不十分（赤）
export function recurrenceBadgeClass(status?: string): string {
  switch (status) {
    case "再発あり":
      return "bg-red-100 text-red-700 border-red-200";
    case "再発なし":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "監視中":
      return "bg-amber-100 text-amber-700 border-amber-200";
    default:
      return "bg-slate-100 text-slate-500 border-slate-200";
  }
}
