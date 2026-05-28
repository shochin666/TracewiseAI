// バックエンドのレスポンスに対応する型定義。
// （backend/app/schemas.py / analysis_engine.py / report_generator.py と一致）

export type ParamStatus = "normal" | "warning" | "abnormal" | "unknown";
export type CauseLevel = "高" | "中" | "低";
export type DefectStatus =
  | "registered"
  | "analyzing"
  | "investigated"
  | "report_generated"
  | "approved";
export type InvestigationResultValue =
  | "abnormal"
  | "normal"
  | "unchecked"
  | "not_applicable";

export interface Product {
  product_id: string;
  product_name?: string;
  screw_type?: string;
  material?: string;
  surface_treatment?: string;
  plating_type?: string;
  size?: string;
  length_mm?: number;
  customer?: string;
  critical_characteristics?: string;
  process_route?: string;
}

export interface Lot {
  lot_id: string;
  product_id?: string;
  work_order_id?: string;
  quantity?: number;
  process_name?: string;
  equipment_id?: string;
  start_time?: string;
  end_time?: string;
  status?: string;
  product?: Product | null;
}

export interface Defect {
  defect_id: number;
  lot_id: string;
  defect_type: string;
  defect_count: number;
  inspected_count: number;
  found_at_process?: string;
  temporary_action?: string;
  note?: string;
  created_at?: string;
  status: DefectStatus;
}

export interface ParamItem {
  key: string;
  label: string;
  value: number | null;
  unit: string;
  min: number;
  max: number;
  risk: "low" | "high" | "both";
  status: ParamStatus;
  note: string;
}

export interface LiveEnvironment {
  measured_at: string;
  poll_hint_sec: number;
  readings: ParamItem[];
  summary: { abnormal: number; warning: number; normal: number };
}

export interface QualityTrend {
  defect_count: number;
  inspected_count: number;
  defect_rate: number;
  target_rate: number;
  judgement: string;
  status: ParamStatus;
  same_type_knowledge: number;
  surface_category: string;
}

export interface SimilarCase {
  case_id: number;
  product_id: string;
  defect_type: string;
  confirmed_cause: string;
  effective_action?: string;
  recurrence_status?: string;
  surface_treatment?: string;
  material?: string;
  process_name?: string;
  summary?: string;
  similarity_score: number;
  reference_level: CauseLevel;
  matched: string[];
  reason: string;
  cause_key?: string | null;
}

export interface CauseActions {
  temporary: string;
  permanent: string;
  prevention: string;
}

export interface CauseCandidate {
  key: string;
  name: string;
  summary: string;
  score: number;
  score_display: number;
  level: CauseLevel;
  confidence: string;
  evidences: string[];
  related_params: ParamItem[];
  reference_cases: SimilarCase[];
  check_items: string[];
  actions: CauseActions;
  rank: number;
  is_lead: boolean;
}

export interface CheckItem {
  id: string;
  label: string;
  cause: string;
  priority: number;
}

export interface InvestigationResult {
  id?: number;
  defect_id?: number;
  check_item: string;
  result: InvestigationResultValue;
  note?: string;
}

export interface AnalysisResult {
  defect: Defect;
  lot: Lot;
  product: Product;
  process_parameters: ParamItem[];
  environment_parameters: ParamItem[];
  process_measured_at?: string;
  environment_measured_at?: string;
  quality_trend: QualityTrend;
  similar_cases: SimilarCase[];
  excluded_cases: SimilarCase[];
  cause_candidates: CauseCandidate[];
  check_items: CheckItem[];
  investigation_results: InvestigationResult[];
  policy_note: string;
}

export interface ReportInvestigationItem {
  check_item: string;
  result: InvestigationResultValue;
  result_label: string;
  note?: string;
}

export interface ReportDraft {
  title: string;
  generated_at: string;
  is_draft: boolean;
  body_text: string;
  summary: {
    lot_id: string;
    defect_type: string;
    found_at_process?: string;
    note?: string;
    created_at?: string;
    status: DefectStatus;
  };
  target_lot: Lot;
  target_product: Product;
  occurrence: {
    defect_count: number;
    inspected_count: number;
    defect_rate: number;
  };
  abnormal_parameters: ParamItem[];
  cause_candidates: CauseCandidate[];
  lead_cause: CauseCandidate | null;
  evidence: string[];
  investigation_summary: {
    items: ReportInvestigationItem[];
    abnormal_count: number;
    checked_count: number;
    total: number;
  };
  temporary_action: string;
  permanent_action_plan: string[];
  action_cautions: string[];
  prevention_plan: string[];
  reference_cases: SimilarCase[];
  excluded_cases: SimilarCase[];
  approval: {
    approver: string | null;
    approved_at: string | null;
    status: DefectStatus;
  };
  policy_note: string;
}

export interface DashboardSummary {
  totals: {
    defects: number;
    knowledge_cases: number;
    approved_defects: number;
    unapproved_defects: number;
    products: number;
    lots: number;
  };
  defect_trend: { date: string; count: number }[];
  cause_breakdown: { cause: string; count: number }[];
  product_breakdown: { product_id: string; product_name: string; count: number }[];
  param_defect_relation: { key: string; label: string; abnormal_defect_count: number }[];
  status_breakdown: { status: string; count: number }[];
  recent_defects: {
    defect_id: number;
    lot_id: string;
    defect_type: string;
    defect_count: number;
    inspected_count: number;
    defect_rate: number;
    status: DefectStatus;
    created_at: string;
  }[];
}

export type RecurrenceStatus = "監視中" | "再発なし" | "再発あり";

export interface KnowledgeCase {
  case_id: number;
  product_id?: string;
  product_name?: string;
  defect_type?: string;
  confirmed_cause?: string;
  effective_action?: string;
  recurrence_status?: string;
  summary?: string;
  created_at?: string;
  surface_treatment?: string;
  material?: string;
  process_name?: string;
  key_parameters?: string;
  // 再発ライフサイクル
  action_implemented_at?: string;
  recurrence_checked_at?: string;
  recurrence_note?: string;
  recurred_lot_id?: string;
  recurrence_ref_case_id?: number;
  // 監視状況（list APIが算出）
  monitoring_days?: number | null;
  monitoring_window?: number;
  recurrence_eligible?: boolean;
}

export interface KnowledgeResponse {
  cases: KnowledgeCase[];
  total: number;
  filters: {
    product_id: string[];
    defect_type: string[];
    confirmed_cause: string[];
    surface_treatment: string[];
  };
}

// リクエスト型
export interface DefectCreatePayload {
  lot_id: string;
  defect_type: string;
  defect_count: number;
  inspected_count: number;
  found_at_process: string;
  temporary_action: string;
  note?: string;
}

export interface DefectCreated {
  defect_id: number;
  status: DefectStatus;
  message: string;
}

export interface ApprovePayload {
  confirmed_cause: string;
  effective_action: string;
  approver?: string;
}

export interface ApproveResult {
  case_id: number;
  defect_id: number;
  status: DefectStatus;
  message: string;
}

export interface RecurrenceUpdatePayload {
  status: "再発なし" | "再発あり";
  note?: string;
}

export interface RecurrenceUpdateResult {
  case_id: number;
  recurrence_status: string;
  recurrence_checked_at: string;
  message: string;
  case: KnowledgeCase;
}
