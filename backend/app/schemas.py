"""
Pydantic スキーマ

リクエストの検証と、主要なレスポンスの型定義に使う。
分析結果のような動的で入れ子が深いレスポンスは dict のまま返すが、
フロントエンドの types.ts と形を一致させている。
"""
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


# ----------------------------------------------------------------------------
# リクエスト
# ----------------------------------------------------------------------------
class DefectCreate(BaseModel):
    """不具合登録リクエスト（現場担当者が入力する事実のみ）。"""
    lot_id: str = Field(..., description="QRコードから取得したロットID")
    defect_type: str = Field(..., description="不具合種別")
    defect_count: int = Field(..., ge=0, description="発生数")
    inspected_count: int = Field(..., gt=0, description="検査数")
    found_at_process: str = Field(..., description="発見場所")
    temporary_action: str = Field(..., description="暫定対応")
    note: Optional[str] = Field(default="", description="補足メモ")


class InvestigationResultItem(BaseModel):
    """確認結果1件。"""
    check_item: str
    result: Literal["abnormal", "normal", "unchecked", "not_applicable"]
    note: Optional[str] = ""


class InvestigationResultsIn(BaseModel):
    """確認結果の保存リクエスト。"""
    results: list[InvestigationResultItem]


class ApproveRequest(BaseModel):
    """報告書承認リクエスト。確定原因と対策を品質担当者が確定する。

    再発有無は承認時点では判定できない（対策実施後の観察結果）ため受け取らない。
    承認時は常に「監視中」で登録し、後日 RecurrenceUpdate で確定する。
    """
    confirmed_cause: str = Field(..., description="承認する確定原因")
    effective_action: str = Field(..., description="有効だった対策")
    approver: Optional[str] = Field(default="品質保証部", description="承認者")


class RecurrenceUpdate(BaseModel):
    """ナレッジ事例の再発有無を後日確定するリクエスト。"""
    status: Literal["再発なし", "再発あり"] = Field(..., description="確定する再発有無")
    note: Optional[str] = Field(default="", description="判定の補足（再発したロット等）")


# ----------------------------------------------------------------------------
# レスポンス（主要なもの。分析結果は dict で返す）
# ----------------------------------------------------------------------------
class ProductOut(BaseModel):
    product_id: str
    product_name: Optional[str] = None
    screw_type: Optional[str] = None
    material: Optional[str] = None
    surface_treatment: Optional[str] = None
    plating_type: Optional[str] = None
    size: Optional[str] = None
    length_mm: Optional[int] = None
    customer: Optional[str] = None
    critical_characteristics: Optional[str] = None
    process_route: Optional[str] = None


class LotOut(BaseModel):
    lot_id: str
    product_id: Optional[str] = None
    work_order_id: Optional[str] = None
    quantity: Optional[int] = None
    process_name: Optional[str] = None
    equipment_id: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    status: Optional[str] = None
    product: Optional[ProductOut] = None


class DefectOut(BaseModel):
    defect_id: int
    lot_id: str
    defect_type: str
    defect_count: int
    inspected_count: int
    found_at_process: Optional[str] = None
    temporary_action: Optional[str] = None
    note: Optional[str] = None
    created_at: Optional[str] = None
    status: str


class DefectCreated(BaseModel):
    defect_id: int
    status: str
    message: str


class ApproveResult(BaseModel):
    case_id: int
    defect_id: int
    status: str
    message: str


class KnowledgeCaseOut(BaseModel):
    case_id: int
    product_id: Optional[str] = None
    product_name: Optional[str] = None
    defect_type: Optional[str] = None
    confirmed_cause: Optional[str] = None
    effective_action: Optional[str] = None
    recurrence_status: Optional[str] = None
    summary: Optional[str] = None
    created_at: Optional[str] = None
    surface_treatment: Optional[str] = None
    material: Optional[str] = None
    process_name: Optional[str] = None
    key_parameters: Optional[str] = None
    # 再発ライフサイクル
    action_implemented_at: Optional[str] = None
    recurrence_checked_at: Optional[str] = None
    recurrence_note: Optional[str] = None
    recurred_lot_id: Optional[str] = None
    recurrence_ref_case_id: Optional[int] = None
    # 監視状況（list APIが算出して付与する派生値）
    monitoring_days: Optional[int] = None
    monitoring_window: Optional[int] = None
    recurrence_eligible: Optional[bool] = None


# 分析結果・ダッシュボード・レポートは構造が動的なため dict で返す。
# 形はフロントエンドの lib/types.ts に対応している。
AnalysisResult = dict[str, Any]
ReportDraft = dict[str, Any]
DashboardSummary = dict[str, Any]
