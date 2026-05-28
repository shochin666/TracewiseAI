"""工場環境のリアルタイム値API（擬似センサー）。

実機センサーは無いデモのため、時間ベースで滑らかに変動する値を生成して返す
（正弦波＋微小ノイズ）。将来は本物のセンサー値に差し替える前提の窓口。
管理基準との照合（正常/注意/異常）は analysis_engine.judge_param を再利用する。
"""
from __future__ import annotations

import math
import random
import time

from fastapi import APIRouter

from ..analysis_engine import judge_param
from ..timeutil import now_str

router = APIRouter(prefix="/api", tags=["environment"])

# 擬似センサーの定義: (パラメータキー, 基準値, 振幅, 周期[秒], 位相, ノイズ幅)
#   value = base + amp*sin(t/period + phase) + uniform(-noise, noise)
#   湿度系は周期的に管理上限(65%)付近へ振れ、注意(黄)・異常(赤)も発生するよう調整。
LIVE_SENSORS = [
    ("factory_temp", 23.0, 2.2, 300, 0.0, 0.4),
    ("factory_humidity", 56.0, 9.0, 240, 1.0, 2.0),
    ("dew_point", 13.0, 4.0, 360, 2.0, 1.0),
    ("storage_humidity", 54.0, 8.5, 280, 0.5, 2.0),
]

# クライアントへの推奨ポーリング間隔（秒）。実機センサーなら数分でよい。
POLL_HINT_SEC = 5


def _sensor_value(base: float, amp: float, period: float, phase: float, noise: float, t: float) -> float:
    return round(base + amp * math.sin(t / period + phase) + random.uniform(-noise, noise), 1)


@router.get("/environment/live")
def environment_live():
    """工場・保管環境の「現在値」を返す（擬似センサー）。

    呼ぶたびに少しずつ変化する。フロントは定期ポーリングで最新値を表示する。
    """
    t = time.time()
    readings = [
        judge_param(key, _sensor_value(base, amp, period, phase, noise, t))
        for key, base, amp, period, phase, noise in LIVE_SENSORS
    ]
    summary = {
        "abnormal": sum(1 for r in readings if r["status"] == "abnormal"),
        "warning": sum(1 for r in readings if r["status"] == "warning"),
        "normal": sum(1 for r in readings if r["status"] == "normal"),
    }
    return {
        "measured_at": now_str("%Y-%m-%d %H:%M:%S"),
        "poll_hint_sec": POLL_HINT_SEC,
        "readings": readings,
        "summary": summary,
    }
