"""報告書下書き生成・承認API。"""
import sqlite3

from fastapi import APIRouter, Depends, HTTPException

from ..analysis_engine import analyze_defect, detect_recurrence, simulate_ai_latency, surface_category
from ..database import get_db_session
from ..models import RECURRENCE_MONITORING
from ..report_generator import generate_report
from ..schemas import ApproveRequest, ApproveResult
from ..timeutil import now_str

router = APIRouter(prefix="/api", tags=["reports"])


@router.get("/reports/{defect_id}")
def get_report(defect_id: int, conn: sqlite3.Connection = Depends(get_db_session)):
    """分析結果と確認結果から報告書下書きを生成して返す。"""
    simulate_ai_latency()  # 本番のAI報告書生成を想定した擬似待機（ローディング表示）
    analysis = analyze_defect(conn, defect_id)
    if analysis is None:
        raise HTTPException(status_code=404, detail=f"不具合が見つかりません: {defect_id}")

    report = generate_report(analysis, analysis.get("investigation_results"))

    # まだ承認前なら status を report_generated に進める
    status = analysis["defect"].get("status")
    if status in ("analyzing", "investigated"):
        conn.execute(
            "UPDATE defects SET status = 'report_generated' WHERE defect_id = ?", (defect_id,)
        )
        report["summary"]["status"] = "report_generated"
        report["approval"]["status"] = "report_generated"
    return report


@router.post("/reports/{defect_id}/approve", response_model=ApproveResult)
def approve_report(
    defect_id: int,
    payload: ApproveRequest,
    conn: sqlite3.Connection = Depends(get_db_session),
):
    """品質担当者が承認し、確定原因を knowledge_cases に登録する。"""
    analysis = analyze_defect(conn, defect_id)
    if analysis is None:
        raise HTTPException(status_code=404, detail=f"不具合が見つかりません: {defect_id}")

    defect = analysis["defect"]
    lot = analysis["lot"]
    product = analysis["product"]

    if defect.get("status") == "approved":
        raise HTTPException(status_code=400, detail="この不具合は既に承認済みです")

    # 異常パラメータのキーをナレッジの key_parameters として残す
    abnormal_keys = [
        p["key"]
        for grp in ("process_parameters", "environment_parameters")
        for p in analysis.get(grp, [])
        if p.get("status") in ("abnormal", "warning")
    ]
    key_params = ",".join(abnormal_keys) if abnormal_keys else "—"

    rate = 0.0
    if defect.get("inspected_count"):
        rate = round(defect["defect_count"] / defect["inspected_count"] * 100, 2)
    summary = (
        f"{defect.get('lot_id')} の{defect.get('defect_type')}（不良率 {rate}%）。"
        f"確認の結果、{payload.confirmed_cause}と確定。対策: {payload.effective_action}。"
    )

    now = now_str()
    # 承認時点では再発有無は判定できないため、必ず「監視中」で登録する。
    # action_implemented_at（＝監視開始）に承認時刻を記録し、後日判定の起点にする。
    cur = conn.execute(
        """
        INSERT INTO knowledge_cases
            (product_id, defect_type, confirmed_cause, effective_action, recurrence_status,
             summary, created_at, surface_treatment, material, process_name, key_parameters,
             action_implemented_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            product.get("product_id"),
            defect.get("defect_type"),
            payload.confirmed_cause,
            payload.effective_action,
            RECURRENCE_MONITORING,
            summary,
            now,
            surface_category(product.get("surface_treatment")),
            product.get("material"),
            lot.get("process_name"),
            key_params,
            now,
        ),
    )
    case_id = cur.lastrowid

    conn.execute("UPDATE defects SET status = 'approved' WHERE defect_id = ?", (defect_id,))

    # 同一品番×同一原因の「監視中」事例があれば、今回の承認は対策後の再発に当たる。
    # 該当事例を「再発あり」へ自動更新する（フィードバックループ）。
    recurred = detect_recurrence(
        conn,
        new_case_id=case_id,
        product_id=product.get("product_id"),
        confirmed_cause=payload.confirmed_cause,
        lot_id=defect.get("lot_id"),
        now=now,
    )

    message = "承認済み事例としてナレッジ化しました（状態: 監視中）。次回以降の原因候補提示に活用されます。"
    if recurred:
        ref = "・".join(f"#{c}" for c in recurred)
        message += (
            f" あわせて、同一原因の過去事例 {len(recurred)} 件（{ref}）を「再発あり」として更新しました。"
            "前回の対策が再発防止に不十分だった可能性があります。"
        )

    return ApproveResult(
        case_id=case_id,
        defect_id=defect_id,
        status="approved",
        message=message,
    )
