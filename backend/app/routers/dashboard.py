"""ダッシュボード集計API。"""
import sqlite3
from collections import Counter, defaultdict

from fastapi import APIRouter, Depends

from ..analysis_engine import PARAM_SPEC_BY_KEY, judge_param
from ..database import get_db_session, row_to_dict, rows_to_list

router = APIRouter(prefix="/api", tags=["dashboard"])

# 「工程パラメータ異常と不具合の関係」で着目する代表パラメータ
KEY_PARAMS = ["drying_temp", "rinse_conductivity", "current_density", "bath_ph", "factory_humidity"]


@router.get("/dashboard/summary")
def dashboard_summary(conn: sqlite3.Connection = Depends(get_db_session)):
    defects = rows_to_list(conn.execute("SELECT * FROM defects").fetchall())
    knowledge = rows_to_list(conn.execute("SELECT * FROM knowledge_cases").fetchall())

    # 1) 不具合件数の推移（日付ごと）
    trend_counter: Counter = Counter()
    for d in defects:
        day = (d.get("created_at") or "")[:10]
        if day:
            trend_counter[day] += 1
    defect_trend = [{"date": k, "count": v} for k, v in sorted(trend_counter.items())]

    # 2) 原因別件数（承認済みナレッジの確定原因ベース）
    cause_counter = Counter(k.get("confirmed_cause") or "未分類" for k in knowledge)
    cause_breakdown = [
        {"cause": c, "count": n}
        for c, n in sorted(cause_counter.items(), key=lambda x: x[1], reverse=True)
    ]

    # 3) 品番別不具合件数（defects → lots → products）
    product_counter: Counter = Counter()
    product_names: dict[str, str] = {}
    for d in defects:
        lot = row_to_dict(
            conn.execute("SELECT product_id FROM lots WHERE lot_id = ?", (d.get("lot_id"),)).fetchone()
        )
        pid = (lot or {}).get("product_id") or "不明"
        product_counter[pid] += 1
        if pid not in product_names:
            prod = row_to_dict(
                conn.execute("SELECT product_name FROM products WHERE product_id = ?", (pid,)).fetchone()
            )
            product_names[pid] = (prod or {}).get("product_name") or pid
    product_breakdown = [
        {"product_id": pid, "product_name": product_names.get(pid, pid), "count": n}
        for pid, n in sorted(product_counter.items(), key=lambda x: x[1], reverse=True)
    ]

    # 4) 工程パラメータ異常と不具合の関係
    #    各代表パラメータについて、それが異常だった不具合の件数を数える
    param_abnormal: dict[str, int] = defaultdict(int)
    measured_cache: dict[str, dict] = {}
    for d in defects:
        lot_id = d.get("lot_id")
        if lot_id not in measured_cache:
            proc = row_to_dict(
                conn.execute(
                    "SELECT * FROM process_parameters WHERE lot_id = ? ORDER BY measured_at DESC, id DESC LIMIT 1",
                    (lot_id,),
                ).fetchone()
            ) or {}
            env = row_to_dict(
                conn.execute(
                    "SELECT * FROM environment_parameters WHERE lot_id = ? ORDER BY measured_at DESC, id DESC LIMIT 1",
                    (lot_id,),
                ).fetchone()
            ) or {}
            measured_cache[lot_id] = {**proc, **env}
        measured = measured_cache[lot_id]
        for key in KEY_PARAMS:
            judged = judge_param(key, measured.get(key))
            if judged["status"] in ("abnormal", "warning"):
                param_abnormal[key] += 1
    param_defect_relation = [
        {
            "key": key,
            "label": PARAM_SPEC_BY_KEY[key]["label"],
            "abnormal_defect_count": param_abnormal.get(key, 0),
        }
        for key in KEY_PARAMS
    ]

    # 5) ステータス別件数・承認/未承認
    status_counter = Counter(d.get("status") or "registered" for d in defects)
    approved_defects = status_counter.get("approved", 0)
    unapproved_defects = len(defects) - approved_defects

    # 6) 直近の不具合一覧
    recent_rows = rows_to_list(
        conn.execute("SELECT * FROM defects ORDER BY created_at DESC, defect_id DESC LIMIT 8").fetchall()
    )
    recent_defects = []
    for d in recent_rows:
        rate = 0.0
        if d.get("inspected_count"):
            rate = round((d.get("defect_count") or 0) / d["inspected_count"] * 100, 2)
        recent_defects.append({
            "defect_id": d.get("defect_id"),
            "lot_id": d.get("lot_id"),
            "defect_type": d.get("defect_type"),
            "defect_count": d.get("defect_count"),
            "inspected_count": d.get("inspected_count"),
            "defect_rate": rate,
            "status": d.get("status"),
            "created_at": d.get("created_at"),
        })

    return {
        "totals": {
            "defects": len(defects),
            "knowledge_cases": len(knowledge),
            "approved_defects": approved_defects,
            "unapproved_defects": unapproved_defects,
            "products": conn.execute("SELECT COUNT(*) AS c FROM products").fetchone()["c"],
            "lots": conn.execute("SELECT COUNT(*) AS c FROM lots").fetchone()["c"],
        },
        "defect_trend": defect_trend,
        "cause_breakdown": cause_breakdown,
        "product_breakdown": product_breakdown,
        "param_defect_relation": param_defect_relation,
        "status_breakdown": [{"status": s, "count": n} for s, n in status_counter.items()],
        "recent_defects": recent_defects,
    }
