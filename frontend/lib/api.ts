// バックエンドAPIクライアント。
// NEXT_PUBLIC_API_BASE_URL でバックエンドのURLを変更できる（既定: http://localhost:8000）。
import type {
  AnalysisResult,
  ApprovePayload,
  ApproveResult,
  DashboardSummary,
  Defect,
  DefectCreatePayload,
  DefectCreated,
  InvestigationResult,
  KnowledgeResponse,
  LiveEnvironment,
  Lot,
  RecurrenceUpdatePayload,
  RecurrenceUpdateResult,
  ReportDraft,
} from "./types";

// API のベースURLの決め方:
//   1. NEXT_PUBLIC_API_BASE_URL が設定されていればそれを使う
//      （ローカルの docker compose は http://localhost:8000 を渡す）。
//   2. 未設定なら、開発は http://localhost:8000（backend を直接叩く）、
//      本番は "" ＝同一オリジンの /api（Next.js の rewrites が backend(内部)へ中継）。
// ※ 空文字の NEXT_PUBLIC_ はビルド時にインライン化されない場合があるため、
//    本番判定は確実にインライン化される NODE_ENV で行う（next build は常に production）。
const RAW_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
export const API_BASE = RAW_API_BASE
  ? RAW_API_BASE
  : process.env.NODE_ENV === "development"
    ? "http://localhost:8000"
    : "";

/** APIエラー（HTTPステータスとサーバの detail を保持する）。 */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      ...init,
    });
  } catch (e) {
    // ネットワーク到達不可（バックエンド未起動など）
    throw new ApiError(
      "バックエンドに接続できませんでした。APIサーバが起動しているか確認してください。",
      0,
    );
  }
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* ignore */
    }
    throw new ApiError(detail, res.status);
  }
  // 204等の空ボディに備える
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export const api = {
  health: () => request<{ status: string }>("/api/health"),

  getLot: (lotId: string) => request<Lot>(`/api/lots/${encodeURIComponent(lotId)}`),

  createDefect: (payload: DefectCreatePayload) =>
    request<DefectCreated>("/api/defects", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getDefect: (id: number) => request<Defect>(`/api/defects/${id}`),

  getAnalysis: (id: number) => request<AnalysisResult>(`/api/analysis/${id}`),

  saveInvestigationResults: (id: number, results: InvestigationResult[]) =>
    request<{ defect_id: number; status: string; saved_count: number; message: string }>(
      `/api/analysis/${id}/investigation-results`,
      { method: "POST", body: JSON.stringify({ results }) },
    ),

  getReport: (id: number) => request<ReportDraft>(`/api/reports/${id}`),

  approveReport: (id: number, payload: ApprovePayload) =>
    request<ApproveResult>(`/api/reports/${id}/approve`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getDashboard: () => request<DashboardSummary>("/api/dashboard/summary"),

  getLiveEnvironment: () => request<LiveEnvironment>("/api/environment/live"),

  getKnowledge: (filters?: Record<string, string | undefined>) => {
    const qs = new URLSearchParams();
    if (filters) {
      for (const [k, v] of Object.entries(filters)) {
        if (v) qs.set(k, v);
      }
    }
    const q = qs.toString();
    return request<KnowledgeResponse>(`/api/knowledge${q ? `?${q}` : ""}`);
  },

  updateRecurrence: (caseId: number, payload: RecurrenceUpdatePayload) =>
    request<RecurrenceUpdateResult>(`/api/knowledge/${caseId}/recurrence`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
};
