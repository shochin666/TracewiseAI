"""AI風 原因分析・確認結果保存API。"""
import sqlite3

from fastapi import APIRouter, Depends, HTTPException

from ..analysis_engine import analyze_defect, simulate_ai_latency
from ..database import get_db_session
from ..schemas import InvestigationResultsIn

router = APIRouter(prefix="/api", tags=["analysis"])


@router.get("/analysis/{defect_id}")
def get_analysis(defect_id: int, conn: sqlite3.Connection = Depends(get_db_session)):
    """工程データ自動紐づけ＋原因候補ランキング＋確認項目を返す。"""
    simulate_ai_latency()  # 本番のAI原因分析を想定した擬似待機（ローディング表示）
    result = analyze_defect(conn, defect_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"不具合が見つかりません: {defect_id}")

    # ステータスを analyzing に進める（registered のときのみ）
    if result["defect"].get("status") == "registered":
        conn.execute(
            "UPDATE defects SET status = 'analyzing' WHERE defect_id = ?", (defect_id,)
        )
        result["defect"]["status"] = "analyzing"
    return result


@router.post("/analysis/{defect_id}/investigation-results")
def save_investigation_results(
    defect_id: int,
    payload: InvestigationResultsIn,
    conn: sqlite3.Connection = Depends(get_db_session),
):
    """確認結果（異常あり/なし/未確認/該当なし）を保存する。"""
    defect = conn.execute(
        "SELECT defect_id, status FROM defects WHERE defect_id = ?", (defect_id,)
    ).fetchone()
    if defect is None:
        raise HTTPException(status_code=404, detail=f"不具合が見つかりません: {defect_id}")

    # 既存の確認結果を入れ替える（再入力に対応）
    conn.execute("DELETE FROM investigation_results WHERE defect_id = ?", (defect_id,))
    for item in payload.results:
        conn.execute(
            "INSERT INTO investigation_results (defect_id, check_item, result, note) VALUES (?, ?, ?, ?)",
            (defect_id, item.check_item, item.result, item.note or ""),
        )

    # ステータスを investigated へ
    conn.execute(
        "UPDATE defects SET status = 'investigated' WHERE defect_id = ?", (defect_id,)
    )
    return {
        "defect_id": defect_id,
        "status": "investigated",
        "saved_count": len(payload.results),
        "message": "確認結果を保存しました。報告書の下書きを生成できます。",
    }
