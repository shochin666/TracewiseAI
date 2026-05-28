"""ロット情報API。"""
from __future__ import annotations

import sqlite3

from fastapi import APIRouter, Depends, HTTPException

from ..database import get_db_session, row_to_dict

router = APIRouter(prefix="/api", tags=["lots"])


def fetch_lot_with_product(conn: sqlite3.Connection, lot_id: str) -> dict | None:
    """ロットと、それに紐づく製品情報をまとめて取得する。"""
    lot = row_to_dict(
        conn.execute("SELECT * FROM lots WHERE lot_id = ?", (lot_id,)).fetchone()
    )
    if lot is None:
        return None
    product = row_to_dict(
        conn.execute(
            "SELECT * FROM products WHERE product_id = ?", (lot.get("product_id"),)
        ).fetchone()
    )
    lot["product"] = product
    return lot


@router.get("/lots/{lot_id}")
def get_lot(lot_id: str, conn: sqlite3.Connection = Depends(get_db_session)):
    """QRコードから得た lot_id でロット情報＋製品情報を返す。"""
    lot = fetch_lot_with_product(conn, lot_id)
    if lot is None:
        raise HTTPException(status_code=404, detail=f"ロットが見つかりません: {lot_id}")
    return lot
