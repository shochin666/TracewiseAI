"""
AI風 原因分析エンジン（ルールベース + スコアリング）

本物のLLMは使わない。工程知識・管理基準・FMEA風ルールで原因候補を出し、
承認済みナレッジ（knowledge_cases）の類似事例でスコアを補正する。

重要な出力ポリシー（要件 7.1）:
  - 原因を断定しない
  - 「可能性が高い」「優先確認を推奨」「原因候補」「確認結果により確定が必要」
    といった表現を使う
"""
from __future__ import annotations

import sqlite3
import time
from typing import Any, Optional

from .database import row_to_dict, rows_to_list
from .models import RECURRENCE_MONITORING, RECURRENCE_YES

# 本番では原因分析・報告書生成をLLM/外部APIへ問い合わせる想定。デモはルールベースで
# 即時に終わるため、その「生成中」の体感（待ち時間）を擬似的に再現する。
SIMULATED_AI_LATENCY_SEC = 1.5


def simulate_ai_latency() -> None:
    """AI生成・外部API問い合わせ想定箇所の擬似待機（フロントのローディング表示用）。"""
    time.sleep(SIMULATED_AI_LATENCY_SEC)

# ---------------------------------------------------------------------------
# 管理基準（PARAM_SPECS）
#   min/max が正常域。risk は「どちら側に振れると不具合リスクか」。
#   warn は正常域内でも risk 側の限界に近いときに警告（黄）にするマージン。
# ---------------------------------------------------------------------------
PARAM_SPECS: list[dict[str, Any]] = [
    # 工程パラメータ
    {"key": "degreasing_temp", "label": "脱脂槽温度", "unit": "℃", "min": 50, "max": 70, "risk": "low", "warn": 3, "group": "process"},
    {"key": "degreasing_concentration", "label": "脱脂剤濃度", "unit": "%", "min": 3, "max": 6, "risk": "low", "warn": 0.4, "group": "process"},
    {"key": "acid_pickling_time_sec", "label": "酸洗時間", "unit": "秒", "min": 60, "max": 180, "risk": "both", "warn": 10, "group": "process"},
    {"key": "rinse_conductivity", "label": "水洗水導電率", "unit": "μS/cm", "min": 5, "max": 80, "risk": "high", "warn": 10, "group": "process"},
    {"key": "rinse_overflow_rate", "label": "水洗オーバーフロー量", "unit": "L/min", "min": 10, "max": 30, "risk": "low", "warn": 2, "group": "process"},
    {"key": "bath_temp", "label": "メッキ浴温度", "unit": "℃", "min": 20, "max": 30, "risk": "both", "warn": 1.5, "group": "process"},
    {"key": "bath_ph", "label": "メッキ浴pH", "unit": "", "min": 4.5, "max": 5.8, "risk": "both", "warn": 0.25, "group": "process"},
    {"key": "zinc_concentration", "label": "亜鉛濃度", "unit": "g/L", "min": 8, "max": 16, "risk": "both", "warn": 1, "group": "process"},
    {"key": "additive_concentration", "label": "添加剤濃度", "unit": "mL/L", "min": 10, "max": 20, "risk": "low", "warn": 1.5, "group": "process"},
    {"key": "current_density", "label": "電流密度", "unit": "A/dm²", "min": 1.5, "max": 3.0, "risk": "low", "warn": 0.3, "group": "process"},
    {"key": "plating_time_min", "label": "メッキ時間", "unit": "分", "min": 30, "max": 60, "risk": "both", "warn": 3, "group": "process"},
    {"key": "chromate_time_sec", "label": "クロメート時間", "unit": "秒", "min": 30, "max": 90, "risk": "both", "warn": 5, "group": "process"},
    {"key": "drying_temp", "label": "乾燥炉温度", "unit": "℃", "min": 80, "max": 120, "risk": "low", "warn": 5, "group": "process"},
    {"key": "drying_time_min", "label": "乾燥時間", "unit": "分", "min": 15, "max": 40, "risk": "low", "warn": 3, "group": "process"},
    # 環境パラメータ
    {"key": "factory_temp", "label": "工場温度", "unit": "℃", "min": 15, "max": 30, "risk": "both", "warn": 2, "group": "environment"},
    {"key": "factory_humidity", "label": "工場湿度", "unit": "%", "min": 30, "max": 65, "risk": "high", "warn": 5, "group": "environment"},
    {"key": "dew_point", "label": "露点", "unit": "℃", "min": 0, "max": 22, "risk": "high", "warn": 2, "group": "environment"},
    {"key": "storage_humidity", "label": "保管庫湿度", "unit": "%", "min": 30, "max": 65, "risk": "high", "warn": 5, "group": "environment"},
    {"key": "storage_time_hour", "label": "保管時間", "unit": "h", "min": 0, "max": 48, "risk": "high", "warn": 6, "group": "environment"},
]
PARAM_SPEC_BY_KEY = {s["key"]: s for s in PARAM_SPECS}


def judge_param(key: str, value: Optional[float]) -> dict[str, Any]:
    """1つのパラメータ値を管理基準と照合し、表示用の情報を返す。"""
    spec = PARAM_SPEC_BY_KEY.get(key)
    if spec is None:
        return {"key": key, "value": value, "status": "unknown"}
    status = "normal"
    note = ""
    if value is None:
        status = "unknown"
    elif value < spec["min"] or value > spec["max"]:
        status = "abnormal"
        side = "下限" if value < spec["min"] else "上限"
        note = f"管理{side}（{spec['min']}〜{spec['max']}{spec['unit']}）を逸脱"
    else:
        # 正常域内でも risk 側の限界に近ければ警告
        warn = spec.get("warn", 0)
        if spec["risk"] in ("low", "both") and value <= spec["min"] + warn:
            status, note = "warning", "管理範囲内（下限寄り）"
        elif spec["risk"] in ("high", "both") and value >= spec["max"] - warn:
            status, note = "warning", "管理範囲内（上限寄り）"
    return {
        "key": key,
        "label": spec["label"],
        "value": value,
        "unit": spec["unit"],
        "min": spec["min"],
        "max": spec["max"],
        "risk": spec["risk"],
        "status": status,  # normal / warning / abnormal / unknown
        "note": note,
    }


def _param_items(measured: dict, group: str) -> list[dict]:
    """工程/環境パラメータを表示用リストに変換する。"""
    items = []
    for spec in PARAM_SPECS:
        if spec["group"] != group:
            continue
        items.append(judge_param(spec["key"], measured.get(spec["key"])))
    return items


# ---------------------------------------------------------------------------
# 原因候補の定義（要件 7.2）
#   param_conditions: (パラメータ, 演算子, しきい値, 加点, 文面テンプレート)
#   borderline: 正常域内だが警告の場合に弱く加点する（"下限寄り" 等）
# ---------------------------------------------------------------------------
SCORE_PARAM = 25       # パラメータ異常 1件あたり
SCORE_DEFECT = 25      # 不具合種別が候補に合致
SCORE_SUPPORT = 20     # 類似事例（承認済みナレッジ）の支持
SCORE_BORDERLINE = 10  # 正常域内だが限界寄り

LEVEL_HIGH = 70        # これ以上で「可能性が高い」
LEVEL_MID = 40         # これ以上で「可能性あり」
DISPLAY_THRESHOLD = 25  # これ未満の候補は表示しない


def _op(value: Optional[float], op: str, thr: float) -> bool:
    if value is None:
        return False
    return {
        "<": value < thr, "<=": value <= thr,
        ">": value > thr, ">=": value >= thr,
    }[op]


CANDIDATE_DEFS: list[dict[str, Any]] = [
    {
        "key": "drying", "name": "乾燥不足",
        "summary": "乾燥工程で水分が残存し、保管中に白っぽい変色・白錆が発生した可能性。",
        "param_conditions": [
            ("drying_temp", "<", 80, "乾燥炉温度 {v}℃ が管理下限80℃を下回っている"),
            ("factory_humidity", ">", 65, "工場湿度 {v}% が管理上限65%を上回っている"),
            ("storage_humidity", ">", 65, "保管庫湿度 {v}% が管理上限65%を上回っている"),
        ],
        "borderline": [],
        "defect_set": {"白っぽい変色", "白錆", "変色"},
        "related_params": ["drying_temp", "drying_time_min", "factory_humidity", "storage_humidity"],
        "check_items": ["乾燥炉の実測温度を確認", "乾燥炉の温度アラーム履歴を確認", "乾燥後の滞留時間を確認", "保管エリア湿度を確認"],
        "actions": {
            "temporary": "乾燥炉温度を実測し設定温度へ是正、対象ロットを再乾燥",
            "permanent": "乾燥炉の温度監視・アラート追加、高湿度時の乾燥条件（温度・時間）見直し",
            "prevention": "日常点検に乾燥炉温度記録を追加、保管庫の除湿・滞留時間管理を標準化",
        },
    },
    {
        "key": "rinse", "name": "水洗不足",
        "summary": "水洗が不十分で残留塩が乾燥後に白化・変色した可能性。",
        "param_conditions": [
            ("rinse_conductivity", ">", 80, "水洗水導電率 {v}μS/cm が管理上限80を上回っている"),
            ("rinse_overflow_rate", "<", 10, "オーバーフロー量 {v}L/min が管理下限10を下回っている"),
        ],
        "borderline": [],
        "defect_set": {"白っぽい変色", "白化", "シミ"},
        "related_params": ["rinse_conductivity", "rinse_overflow_rate"],
        "check_items": ["水洗水導電率を再測定", "オーバーフロー量を確認", "水洗槽の交換履歴を確認", "ノズル詰まりを確認"],
        "actions": {
            "temporary": "水洗水を交換しオーバーフロー量を増加、対象ロットを再水洗",
            "permanent": "水洗水導電率の連続監視、定期交換基準の設定",
            "prevention": "導電率上限アラームの設置、ノズル点検を標準作業に追加",
        },
    },
    {
        "key": "current", "name": "電流密度異常",
        "summary": "通電が低下し、メッキムラ・膜厚不足が生じた可能性。",
        "param_conditions": [
            ("current_density", "<", 1.5, "電流密度 {v}A/dm² が管理下限1.5を下回り一時的に低下している"),
        ],
        "borderline": [],
        "defect_set": {"メッキムラ", "膜厚不足"},
        "related_params": ["current_density", "plating_time_min"],
        "check_items": ["電流ログを確認", "バレル回転状態を確認", "接点不良を確認"],
        "actions": {
            "temporary": "電流値・接点を点検し、対象ロットの再メッキ要否を判定",
            "permanent": "電流ログの常時監視と接点清掃の定期化",
            "prevention": "バレル回転・接点点検をチェックリスト化",
        },
    },
    {
        "key": "ph", "name": "メッキ浴pH変動",
        "summary": "メッキ浴pHの変動により、メッキムラ・光沢不良・変色が生じる可能性。",
        "param_conditions": [
            ("bath_ph", "<", 4.5, "メッキ浴pH {v} が管理下限4.5を下回っている"),
            ("bath_ph", ">", 5.8, "メッキ浴pH {v} が管理上限5.8を上回っている"),
        ],
        "borderline": [("bath_ph", "メッキ浴pH {v} は管理範囲内だが下限寄りで監視が必要")],
        "defect_set": {"メッキムラ", "光沢不良", "変色"},
        "related_params": ["bath_ph", "bath_temp", "zinc_concentration"],
        "check_items": ["pHを再測定", "浴分析結果を確認", "薬液補給履歴を確認"],
        "actions": {
            "temporary": "pHを再測定し薬液補給で管理範囲へ調整",
            "permanent": "pHの自動監視・自動補給の検討",
            "prevention": "浴分析頻度の見直しと補給ルールの標準化",
        },
    },
    {
        "key": "degreasing", "name": "脱脂不足",
        "summary": "脱脂不足で油分が残存し、密着不良・はがれが生じる可能性。",
        "param_conditions": [
            ("degreasing_temp", "<", 50, "脱脂槽温度 {v}℃ が管理下限50℃を下回っている"),
            ("degreasing_concentration", "<", 3, "脱脂剤濃度 {v}% が管理下限3%を下回っている"),
        ],
        "borderline": [],
        "defect_set": {"密着不良", "はがれ"},
        "related_params": ["degreasing_temp", "degreasing_concentration"],
        "check_items": ["脱脂液濃度を確認", "脱脂液温度を確認", "前処理槽の汚れを確認"],
        "actions": {
            "temporary": "脱脂液濃度・温度を是正し前処理槽を清掃",
            "permanent": "脱脂液の管理基準（濃度・温度）を厳格化",
            "prevention": "脱脂液の定期分析・交換基準を設定",
        },
    },
]
CANDIDATE_BY_KEY = {c["key"]: c for c in CANDIDATE_DEFS}

# 承認済みナレッジの confirmed_cause を候補キーへ対応づける
CAUSE_ALIASES = {
    "乾燥不足": "drying",
    "水洗不足": "rinse",
    "電流密度低下": "current", "通電不良": "current", "電流密度異常": "current",
    "メッキ浴pH変動": "ph", "pH変動": "ph", "pH低下": "ph",
    "脱脂不足": "degreasing",
}


def cause_to_key(cause: Optional[str]) -> Optional[str]:
    if not cause:
        return None
    return CAUSE_ALIASES.get(cause.strip())


# ---------------------------------------------------------------------------
# 再発の自動検知（承認時に呼ぶ）
# ---------------------------------------------------------------------------
def detect_recurrence(
    conn: sqlite3.Connection,
    *,
    new_case_id: int,
    product_id: Optional[str],
    confirmed_cause: Optional[str],
    lot_id: Optional[str],
    now: str,
) -> list[int]:
    """新規承認(new_case_id)が過去の「監視中」事例の再発に当たるか判定する。

    同一品番 × 同一確定原因の監視中事例があれば、それは対策実施後の再発とみなし
    『再発あり』へ自動更新する（recurred_lot_id / recurrence_ref_case_id を記録）。
    更新した case_id のリストを返す。「再発なし」は事象では断定できないため扱わない。
    """
    if not product_id or not confirmed_cause:
        return []
    rows = conn.execute(
        """
        SELECT case_id FROM knowledge_cases
        WHERE case_id != ? AND product_id = ? AND confirmed_cause = ?
          AND recurrence_status = ?
        """,
        (new_case_id, product_id, confirmed_cause, RECURRENCE_MONITORING),
    ).fetchall()
    ids = [r["case_id"] for r in rows]
    note = (
        f"{lot_id} で同一原因『{confirmed_cause}』が再発（根拠: 事例#{new_case_id}）。"
        f"前回の対策は再発防止に不十分と判断。"
    )
    for cid in ids:
        conn.execute(
            """
            UPDATE knowledge_cases
            SET recurrence_status = ?, recurrence_checked_at = ?,
                recurred_lot_id = ?, recurrence_ref_case_id = ?, recurrence_note = ?
            WHERE case_id = ?
            """,
            (RECURRENCE_YES, now, lot_id, new_case_id, note, cid),
        )
    return ids


# ---------------------------------------------------------------------------
# 表面処理カテゴリの正規化（"亜鉛メッキ 三価クロメート" → "亜鉛メッキ" 等）
# ---------------------------------------------------------------------------
def surface_category(s: Optional[str]) -> str:
    if not s:
        return ""
    if "亜鉛ニッケル" in s:
        return "亜鉛ニッケルメッキ"
    if "亜鉛" in s:
        return "亜鉛メッキ"
    if "不動態" in s or "ステンレス" in s:
        return "不動態化処理"
    if "黒" in s:
        return "黒染め"
    return s.strip()


# ---------------------------------------------------------------------------
# 類似事例スコアリング（要件 7.3）
# ---------------------------------------------------------------------------
SIM_PRODUCT = 30
SIM_SURFACE = 25
SIM_MATERIAL = 15
SIM_DEFECT = 25
SIM_PROCESS = 10
SIM_INCLUDE_THRESHOLD = 50  # これ以上を「参考にする事例」、未満を「除外」


def _similarity(case: dict, product: dict, lot: dict, defect_type: str) -> dict:
    """1つのナレッジ事例について、今回の不具合との類似度を計算する。"""
    star_surface = surface_category(product.get("surface_treatment"))
    case_surface = surface_category(case.get("surface_treatment"))
    star_material = product.get("material")
    star_process = lot.get("process_name")

    score = 0
    matched = []
    if case.get("product_id") and case["product_id"] == product.get("product_id"):
        score += SIM_PRODUCT
        matched.append("品番一致")
    if case_surface and case_surface == star_surface:
        score += SIM_SURFACE
        matched.append("表面処理一致")
    if case.get("material") and case["material"] == star_material:
        score += SIM_MATERIAL
        matched.append("材質一致")
    if case.get("defect_type") and case["defect_type"] == defect_type:
        score += SIM_DEFECT
        matched.append("不具合種別一致")
    if case.get("process_name") and case["process_name"] == star_process:
        score += SIM_PROCESS
        matched.append("工程一致")

    # 参考度ラベル
    if score >= 80:
        level = "高"
    elif score >= SIM_INCLUDE_THRESHOLD:
        level = "中"
    else:
        level = "低"

    reason = _similar_reason(case, case_surface, star_surface, score, matched)
    return {
        "case_id": case.get("case_id"),
        "product_id": case.get("product_id"),
        "defect_type": case.get("defect_type"),
        "confirmed_cause": case.get("confirmed_cause"),
        "effective_action": case.get("effective_action"),
        "recurrence_status": case.get("recurrence_status"),
        "surface_treatment": case.get("surface_treatment"),
        "material": case.get("material"),
        "process_name": case.get("process_name"),
        "summary": case.get("summary"),
        "similarity_score": score,
        "reference_level": level,
        "matched": matched,
        "reason": reason,
        "cause_key": cause_to_key(case.get("confirmed_cause")),
    }


def _similar_reason(case: dict, case_surface: str, star_surface: str, score: int, matched: list[str]) -> str:
    """参考度の理由文を日本語で生成する。"""
    if case_surface != star_surface:
        # 表面処理・処理方式が異なるケース（除外寄り）
        return (
            f"{case.get('surface_treatment')}（{case.get('process_name')}）の事例のため、"
            f"今回の{star_surface}とは処理条件が異なる（参考度低）"
        )
    if score >= 80:
        return f"同じ{star_surface}工程・条件が近く参考度が高い（{'・'.join(matched)}）"
    return f"同じ{star_surface}工程だが一部条件が異なるため参考度は中（{'・'.join(matched)}）"


# ---------------------------------------------------------------------------
# 原因候補スコアリング
# ---------------------------------------------------------------------------
def _evaluate_candidate(cdef: dict, measured: dict, defect_type: str, similar_cases: list[dict]) -> dict:
    """1つの原因候補を評価し、スコア・根拠・参考事例・確認項目を組み立てる。"""
    evidences: list[str] = []
    param_points = 0

    # パラメータ条件
    for key, op, thr, tmpl in cdef["param_conditions"]:
        value = measured.get(key)
        if _op(value, op, thr):
            param_points += SCORE_PARAM
            evidences.append(tmpl.format(v=value))

    # 限界寄り（弱い加点）
    border_points = 0
    for key, tmpl in cdef.get("borderline", []):
        judged = judge_param(key, measured.get(key))
        if judged["status"] == "warning":
            border_points += SCORE_BORDERLINE
            evidences.append(tmpl.format(v=measured.get(key)))

    # 不具合種別の合致
    defect_points = 0
    if defect_type in cdef["defect_set"]:
        defect_points = SCORE_DEFECT
        evidences.append(f"不具合種別「{defect_type}」がこの原因で発生しやすいパターンに合致")

    # 類似事例（承認済みナレッジ）の支持。ただし現工程に何らかの兆候があるときのみ加点。
    supporting = [c for c in similar_cases if c.get("cause_key") == cdef["key"]]
    support_points = 0
    has_signal = (param_points + border_points + defect_points) > 0
    if supporting and has_signal:
        support_points = SCORE_SUPPORT
        evidences.append(
            f"承認済みナレッジ {len(supporting)} 件が本候補を支持（ナレッジ補正 +{SCORE_SUPPORT}）"
        )

    score = param_points + border_points + defect_points + support_points

    level = "高" if score >= LEVEL_HIGH else ("中" if score >= LEVEL_MID else "低")
    confidence = {
        "高": "可能性が高い（優先確認を推奨）",
        "中": "可能性あり（確認を推奨）",
        "低": "可能性は低いが念のため確認",
    }[level]

    related_params = [judge_param(k, measured.get(k)) for k in cdef["related_params"]]

    return {
        "key": cdef["key"],
        "name": cdef["name"],
        "summary": cdef["summary"],
        "score": score,
        "score_display": min(100, score),  # バー表示用に100で頭打ち
        "level": level,
        "confidence": confidence,
        "evidences": evidences,
        "related_params": related_params,
        "reference_cases": supporting,
        "check_items": cdef["check_items"],
        "actions": cdef["actions"],
    }


# ---------------------------------------------------------------------------
# DB アクセス補助
# ---------------------------------------------------------------------------
def _latest_process(conn: sqlite3.Connection, lot_id: str) -> dict:
    row = conn.execute(
        "SELECT * FROM process_parameters WHERE lot_id = ? ORDER BY measured_at DESC, id DESC LIMIT 1",
        (lot_id,),
    ).fetchone()
    return row_to_dict(row) or {}


def _latest_environment(conn: sqlite3.Connection, lot_id: str) -> dict:
    row = conn.execute(
        "SELECT * FROM environment_parameters WHERE lot_id = ? ORDER BY measured_at DESC, id DESC LIMIT 1",
        (lot_id,),
    ).fetchone()
    return row_to_dict(row) or {}


def _quality_trend(conn: sqlite3.Connection, defect: dict, product: dict) -> dict:
    """品質傾向（不良率と過去同種件数）。"""
    inspected = defect.get("inspected_count") or 0
    count = defect.get("defect_count") or 0
    rate = round(count / inspected * 100, 2) if inspected else 0.0
    target = 1.0
    star_surface = surface_category(product.get("surface_treatment"))
    same_type = conn.execute(
        "SELECT COUNT(*) AS c FROM knowledge_cases WHERE defect_type = ?",
        (defect.get("defect_type"),),
    ).fetchone()["c"]
    return {
        "defect_count": count,
        "inspected_count": inspected,
        "defect_rate": rate,
        "target_rate": target,
        "judgement": f"管理目標({target}%)を上回る" if rate > target else f"管理目標({target}%)以内",
        "status": "abnormal" if rate > target * 2 else ("warning" if rate > target else "normal"),
        "same_type_knowledge": same_type,
        "surface_category": star_surface,
    }


# ---------------------------------------------------------------------------
# メイン関数
# ---------------------------------------------------------------------------
def analyze_defect(conn: sqlite3.Connection, defect_id: int) -> Optional[dict]:
    """不具合IDから完全な分析結果を組み立てる。見つからなければ None。"""
    defect = row_to_dict(
        conn.execute("SELECT * FROM defects WHERE defect_id = ?", (defect_id,)).fetchone()
    )
    if defect is None:
        return None

    lot = row_to_dict(
        conn.execute("SELECT * FROM lots WHERE lot_id = ?", (defect["lot_id"],)).fetchone()
    ) or {}
    product = row_to_dict(
        conn.execute("SELECT * FROM products WHERE product_id = ?", (lot.get("product_id"),)).fetchone()
    ) or {}

    process = _latest_process(conn, defect["lot_id"])
    environment = _latest_environment(conn, defect["lot_id"])
    # 条件評価のため工程＋環境をマージ
    measured = {**process, **environment}

    defect_type = defect.get("defect_type")

    # 類似事例スコアリング
    all_cases = rows_to_list(
        conn.execute("SELECT * FROM knowledge_cases ORDER BY created_at DESC").fetchall()
    )
    scored = [_similarity(c, product, lot, defect_type) for c in all_cases]
    scored.sort(key=lambda x: x["similarity_score"], reverse=True)
    similar_cases = [s for s in scored if s["similarity_score"] >= SIM_INCLUDE_THRESHOLD]
    excluded_cases = [s for s in scored if s["similarity_score"] < SIM_INCLUDE_THRESHOLD]

    # 原因候補スコアリング（支持は「参考にする事例」のみから集計）
    candidates = [
        _evaluate_candidate(cdef, measured, defect_type, similar_cases)
        for cdef in CANDIDATE_DEFS
    ]
    candidates = [c for c in candidates if c["score"] >= DISPLAY_THRESHOLD]
    candidates.sort(key=lambda x: x["score"], reverse=True)
    for i, c in enumerate(candidates):
        c["rank"] = i + 1
        c["is_lead"] = i == 0

    # 優先確認項目（上位候補の確認項目を順序維持で重複排除）
    check_items: list[dict] = []
    seen = set()
    for c in candidates:
        for label in c["check_items"]:
            if label in seen:
                continue
            seen.add(label)
            check_items.append({
                "id": f"chk-{len(check_items)+1}",
                "label": label,
                "cause": c["name"],
                "priority": len(check_items) + 1,
            })

    # 既に保存済みの確認結果（フォームのプリフィル用）
    investigation = rows_to_list(
        conn.execute(
            "SELECT * FROM investigation_results WHERE defect_id = ? ORDER BY id",
            (defect_id,),
        ).fetchall()
    )

    return {
        "defect": defect,
        "lot": lot,
        "product": product,
        "process_parameters": _param_items(measured, "process"),
        "environment_parameters": _param_items(measured, "environment"),
        "process_measured_at": process.get("measured_at"),
        "environment_measured_at": environment.get("measured_at"),
        "quality_trend": _quality_trend(conn, defect, product),
        "similar_cases": similar_cases,
        "excluded_cases": excluded_cases,
        "cause_candidates": candidates,
        "check_items": check_items,
        "investigation_results": investigation,
        "policy_note": (
            "本結果はルールベースのAI風分析による原因候補です。"
            "AIは原因を断定しません。確認結果と品質担当者の承認により確定します。"
        ),
    }
