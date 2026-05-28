"""承認済みナレッジ一覧API（フィルタ対応）＋再発有無の後日判定API。"""
import sqlite3
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from ..database import get_db_session, row_to_dict, rows_to_list
from ..models import MONITORING_WINDOW_DAYS, RECURRENCE_MONITORING
from ..schemas import RecurrenceUpdate
from ..timeutil import days_since, now_str

router = APIRouter(prefix="/api", tags=["knowledge"])


@router.get("/knowledge")
def list_knowledge(
    conn: sqlite3.Connection = Depends(get_db_session),
    product_id: Optional[str] = Query(default=None),
    defect_type: Optional[str] = Query(default=None),
    confirmed_cause: Optional[str] = Query(default=None),
    surface_treatment: Optional[str] = Query(default=None),
):
    """承認済み事例を新しい順に返す。クエリでフィルタできる。"""
    sql = """
        SELECT k.*, p.product_name
        FROM knowledge_cases k
        LEFT JOIN products p ON p.product_id = k.product_id
        WHERE 1 = 1
    """
    params: list = []
    if product_id:
        sql += " AND k.product_id = ?"
        params.append(product_id)
    if defect_type:
        sql += " AND k.defect_type = ?"
        params.append(defect_type)
    if confirmed_cause:
        sql += " AND k.confirmed_cause = ?"
        params.append(confirmed_cause)
    if surface_treatment:
        sql += " AND k.surface_treatment = ?"
        params.append(surface_treatment)
    sql += " ORDER BY k.created_at DESC, k.case_id DESC"

    cases = rows_to_list(conn.execute(sql, params).fetchall())

    # 監視状況の派生値を付与（監視中の事例だけ経過日数・確定可否を計算）
    for c in cases:
        c["monitoring_window"] = MONITORING_WINDOW_DAYS
        if c.get("recurrence_status") == RECURRENCE_MONITORING:
            elapsed = days_since(c.get("action_implemented_at") or c.get("created_at"))
            c["monitoring_days"] = elapsed
            c["recurrence_eligible"] = elapsed is not None and elapsed >= MONITORING_WINDOW_DAYS
        else:
            c["monitoring_days"] = None
            c["recurrence_eligible"] = False

    # フィルタUI用の選択肢（全件から抽出）
    def distinct(col: str) -> list[str]:
        rows = conn.execute(
            f"SELECT DISTINCT {col} AS v FROM knowledge_cases WHERE {col} IS NOT NULL AND {col} != '' ORDER BY {col}"
        ).fetchall()
        return [r["v"] for r in rows]

    return {
        "cases": cases,
        "total": len(cases),
        "filters": {
            "product_id": distinct("product_id"),
            "defect_type": distinct("defect_type"),
            "confirmed_cause": distinct("confirmed_cause"),
            "surface_treatment": distinct("surface_treatment"),
        },
    }


@router.patch("/knowledge/{case_id}/recurrence")
def update_recurrence(
    case_id: int,
    payload: RecurrenceUpdate,
    conn: sqlite3.Connection = Depends(get_db_session),
):
    """ナレッジ事例の再発有無を後日確定する（監視中 → 再発なし / 再発あり）。

    「再発なし」は監視期間満了後に、「再発あり」は再発を確認した時点で品質担当者が確定する。
    （新規承認時の自動検知＝detect_recurrence とは別の、手動確定の経路。）
    """
    row = conn.execute(
        "SELECT * FROM knowledge_cases WHERE case_id = ?", (case_id,)
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail=f"事例が見つかりません: {case_id}")

    now = now_str()
    conn.execute(
        """
        UPDATE knowledge_cases
        SET recurrence_status = ?, recurrence_checked_at = ?, recurrence_note = ?
        WHERE case_id = ?
        """,
        (payload.status, now, payload.note or "", case_id),
    )
    updated = row_to_dict(
        conn.execute("SELECT * FROM knowledge_cases WHERE case_id = ?", (case_id,)).fetchone()
    )
    return {
        "case_id": case_id,
        "recurrence_status": payload.status,
        "recurrence_checked_at": now,
        "message": f"事例#{case_id} を「{payload.status}」として確定しました。",
        "case": updated,
    }
