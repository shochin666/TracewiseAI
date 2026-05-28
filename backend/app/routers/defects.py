"""不具合の登録・取得API。"""
import sqlite3

from fastapi import APIRouter, Depends, HTTPException

from ..database import get_db_session, row_to_dict
from ..schemas import DefectCreate, DefectCreated, DefectOut
from ..timeutil import now_str

router = APIRouter(prefix="/api", tags=["defects"])


@router.post("/defects", response_model=DefectCreated, status_code=201)
def create_defect(payload: DefectCreate, conn: sqlite3.Connection = Depends(get_db_session)):
    """現場担当者が「見た事実」だけを登録する。原因は入力させない。"""
    # ロットの存在確認
    lot = conn.execute("SELECT lot_id FROM lots WHERE lot_id = ?", (payload.lot_id,)).fetchone()
    if lot is None:
        raise HTTPException(status_code=404, detail=f"ロットが見つかりません: {payload.lot_id}")

    if payload.defect_count > payload.inspected_count:
        raise HTTPException(status_code=400, detail="発生数が検査数を超えています")

    now = now_str()
    cur = conn.execute(
        """
        INSERT INTO defects
            (lot_id, defect_type, defect_count, inspected_count,
             found_at_process, temporary_action, note, created_at, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'registered')
        """,
        (
            payload.lot_id, payload.defect_type, payload.defect_count, payload.inspected_count,
            payload.found_at_process, payload.temporary_action, payload.note or "", now,
        ),
    )
    defect_id = cur.lastrowid
    return DefectCreated(
        defect_id=defect_id,
        status="registered",
        message="不具合を登録しました。続けて工程データの自動紐づけと原因分析を行います。",
    )


@router.get("/defects/{defect_id}", response_model=DefectOut)
def get_defect(defect_id: int, conn: sqlite3.Connection = Depends(get_db_session)):
    defect = row_to_dict(
        conn.execute("SELECT * FROM defects WHERE defect_id = ?", (defect_id,)).fetchone()
    )
    if defect is None:
        raise HTTPException(status_code=404, detail=f"不具合が見つかりません: {defect_id}")
    return defect
