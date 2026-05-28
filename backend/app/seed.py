"""
サンプルデータ投入

要件 5.x のサンプルに沿った現実感のあるダミーデータを投入する。
主役ロット LOT-2026-0527-PM-01 には、白っぽい変色の原因として
「乾燥不足」「水洗不足」が浮かび、「電流密度異常」も候補に出るよう
異常傾向を仕込んでいる。

このモジュールは単体でも実行できる:
    python -m app.seed
"""
import json
import os
import sqlite3
from datetime import timedelta

from . import models
from .database import get_connection, init_db
from .timeutil import now_jst

# 各時刻は「シード生成時点の現在(JST)」を基準に相対指定する。
# これにより測定時刻が常に直近になり、実日付が進んでも古く見えない。
# 不具合の登録時刻(現在)より前＝処理時刻、という前後関係も保たれる。
# （_NOW はインポート時に評価。開発はコード変更でリロードされるため十分新しい。）
_NOW = now_jst()


def _hours_ago(hours: float) -> str:
    """現在(JST)から hours 時間前 'YYYY-MM-DD HH:MM'（時刻によらず必ず過去）。"""
    return (_NOW - timedelta(hours=hours)).strftime("%Y-%m-%d %H:%M")


def _days_ago_at(days: int, hour: int, minute: int = 0) -> str:
    """現在(JST)から days 日前の指定時刻 'YYYY-MM-DD HH:MM'（days>=1 なら必ず過去）。"""
    d = (_NOW - timedelta(days=days)).replace(hour=hour, minute=minute, second=0, microsecond=0)
    return d.strftime("%Y-%m-%d %H:%M")


def _day(days: int) -> str:
    """現在(JST)から days 日前 'YYYY-MM-DD'。"""
    return (_NOW - timedelta(days=days)).strftime("%Y-%m-%d")

# ---------------------------------------------------------------------------
# 5.1 製品マスタ
# ---------------------------------------------------------------------------
PRODUCTS = [
    {
        "product_id": "SCR-2041", "product_name": "六角ボルト M8×25", "screw_type": "六角ボルト",
        "material": "炭素鋼", "surface_treatment": "亜鉛メッキ 三価クロメート", "plating_type": "バレル亜鉛メッキ",
        "size": "M8×25", "length_mm": 25, "customer": "A自動車部品",
        "critical_characteristics": "防錆性・外観・膜厚", "process_route": "脱脂→酸洗→水洗→亜鉛メッキ→水洗→クロメート→乾燥",
    },
    {
        "product_id": "SCR-2042", "product_name": "小ねじ M4×12", "screw_type": "小ねじ",
        "material": "炭素鋼", "surface_treatment": "亜鉛メッキ 三価クロメート", "plating_type": "バレル亜鉛メッキ",
        "size": "M4×12", "length_mm": 12, "customer": "B電機",
        "critical_characteristics": "外観・ねじ精度", "process_route": "脱脂→酸洗→水洗→亜鉛メッキ→水洗→クロメート→乾燥",
    },
    {
        "product_id": "SCR-2043", "product_name": "タッピングねじ M5×16", "screw_type": "タッピングねじ",
        "material": "ステンレス", "surface_treatment": "不動態化処理", "plating_type": "非メッキ",
        "size": "M5×16", "length_mm": 16, "customer": "C精密機器",
        "critical_characteristics": "耐食性・外観", "process_route": "脱脂→酸洗→不動態化→乾燥",
    },
    {
        "product_id": "SCR-2044", "product_name": "フランジボルト M8×20", "screw_type": "フランジボルト",
        "material": "炭素鋼", "surface_treatment": "黒色酸化皮膜", "plating_type": "黒染め",
        "size": "M8×20", "length_mm": 20, "customer": "D建設機械",
        "critical_characteristics": "外観・防錆油付着", "process_route": "脱脂→酸洗→黒染め→水洗→防錆油",
    },
    {
        "product_id": "SCR-2045", "product_name": "六角ボルト M8×25", "screw_type": "六角ボルト",
        "material": "炭素鋼", "surface_treatment": "亜鉛ニッケルメッキ", "plating_type": "ラックメッキ",
        "size": "M8×25", "length_mm": 25, "customer": "A自動車部品",
        "critical_characteristics": "耐食性・光沢・膜厚", "process_route": "脱脂→酸洗→水洗→亜鉛ニッケルメッキ→水洗→クロメート→乾燥",
    },
]

# ---------------------------------------------------------------------------
# 5.2 ロット
# ---------------------------------------------------------------------------
LOTS = [
    {
        "lot_id": "LOT-2026-0527-AM-01", "product_id": "SCR-2041", "work_order_id": "WO-26052701",
        "quantity": 5000, "process_name": "バレル亜鉛メッキ", "equipment_id": "BARREL-01",
        "start_time": _days_ago_at(1, 8, 30), "end_time": _days_ago_at(1, 10, 30), "status": "completed",
    },
    {
        # ★ 主役ロット（白っぽい変色の発生ロット）。今日の数時間前に処理＝測定時刻が直近・登録より前。
        "lot_id": "LOT-2026-0527-PM-01", "product_id": "SCR-2041", "work_order_id": "WO-26052702",
        "quantity": 5000, "process_name": "バレル亜鉛メッキ", "equipment_id": "BARREL-01",
        "start_time": _hours_ago(5), "end_time": _hours_ago(3), "status": "completed",
    },
    {
        "lot_id": "LOT-2026-0528-AM-01", "product_id": "SCR-2042", "work_order_id": "WO-26052801",
        "quantity": 12000, "process_name": "バレル亜鉛メッキ", "equipment_id": "BARREL-02",
        "start_time": _days_ago_at(2, 8, 30), "end_time": _days_ago_at(2, 10, 10), "status": "completed",
    },
    {
        "lot_id": "LOT-2026-0528-PM-01", "product_id": "SCR-2044", "work_order_id": "WO-26052802",
        "quantity": 4000, "process_name": "黒染め", "equipment_id": "BLACK-01",
        "start_time": _days_ago_at(2, 13, 30), "end_time": _days_ago_at(2, 15, 0), "status": "completed",
    },
    {
        "lot_id": "LOT-2026-0529-AM-01", "product_id": "SCR-2045", "work_order_id": "WO-26052901",
        "quantity": 3000, "process_name": "ラックメッキ", "equipment_id": "RACK-01",
        "start_time": _days_ago_at(3, 8, 30), "end_time": _days_ago_at(3, 11, 0), "status": "completed",
    },
]

# ---------------------------------------------------------------------------
# 5.3 工程パラメータ（ロットごとに1レコード = 処理時の代表値）
#   管理基準（analysis_engine.PARAM_SPECS）に対して、主役ロットだけ異常を仕込む。
# ---------------------------------------------------------------------------
PROCESS_PARAMETERS = [
    {  # 正常ロット
        "lot_id": "LOT-2026-0527-AM-01", "measured_at": _days_ago_at(1, 10, 30),
        "degreasing_temp": 58, "degreasing_concentration": 4.3, "acid_pickling_time_sec": 120,
        "rinse_conductivity": 46, "rinse_overflow_rate": 14, "bath_temp": 26, "bath_ph": 5.2,
        "zinc_concentration": 11.5, "additive_concentration": 15, "current_density": 2.4,
        "plating_time_min": 45, "chromate_time_sec": 60, "drying_temp": 97, "drying_time_min": 25,
    },
    {  # ★ 主役ロット：乾燥温度低・水洗導電率高・オーバーフロー低・電流密度低下・pH下限寄り
        "lot_id": "LOT-2026-0527-PM-01", "measured_at": _hours_ago(3),
        "degreasing_temp": 57, "degreasing_concentration": 4.0, "acid_pickling_time_sec": 125,
        "rinse_conductivity": 118, "rinse_overflow_rate": 7.5, "bath_temp": 25, "bath_ph": 4.6,
        "zinc_concentration": 10.5, "additive_concentration": 14, "current_density": 1.3,
        "plating_time_min": 45, "chromate_time_sec": 58, "drying_temp": 66, "drying_time_min": 22,
    },
    {  # 正常ロット
        "lot_id": "LOT-2026-0528-AM-01", "measured_at": _days_ago_at(2, 10, 10),
        "degreasing_temp": 59, "degreasing_concentration": 4.5, "acid_pickling_time_sec": 110,
        "rinse_conductivity": 52, "rinse_overflow_rate": 13, "bath_temp": 27, "bath_ph": 5.1,
        "zinc_concentration": 12, "additive_concentration": 16, "current_density": 2.5,
        "plating_time_min": 40, "chromate_time_sec": 62, "drying_temp": 95, "drying_time_min": 24,
    },
    {  # 黒染めロット（亜鉛メッキの管理基準は適用対象外。デモでは正常域の代表値）
        "lot_id": "LOT-2026-0528-PM-01", "measured_at": _days_ago_at(2, 15, 0),
        "degreasing_temp": 60, "degreasing_concentration": 4.8, "acid_pickling_time_sec": 100,
        "rinse_conductivity": 50, "rinse_overflow_rate": 12, "bath_temp": 28, "bath_ph": 5.0,
        "zinc_concentration": 11, "additive_concentration": 15, "current_density": 2.3,
        "plating_time_min": 35, "chromate_time_sec": 55, "drying_temp": 92, "drying_time_min": 23,
    },
    {  # 亜鉛ニッケルロット（同上、正常域の代表値）
        "lot_id": "LOT-2026-0529-AM-01", "measured_at": _days_ago_at(3, 11, 0),
        "degreasing_temp": 61, "degreasing_concentration": 5.0, "acid_pickling_time_sec": 130,
        "rinse_conductivity": 44, "rinse_overflow_rate": 15, "bath_temp": 29, "bath_ph": 5.4,
        "zinc_concentration": 13, "additive_concentration": 18, "current_density": 2.6,
        "plating_time_min": 50, "chromate_time_sec": 65, "drying_temp": 99, "drying_time_min": 26,
    },
]

# ---------------------------------------------------------------------------
# 5.4 環境パラメータ
# ---------------------------------------------------------------------------
ENVIRONMENT_PARAMETERS = [
    {
        "lot_id": "LOT-2026-0527-AM-01", "measured_at": _days_ago_at(1, 10, 30),
        "factory_temp": 23, "factory_humidity": 52, "dew_point": 12, "storage_humidity": 55, "storage_time_hour": 20,
    },
    {  # ★ 主役ロット：工場湿度・保管庫湿度が高い
        "lot_id": "LOT-2026-0527-PM-01", "measured_at": _hours_ago(3),
        "factory_temp": 25, "factory_humidity": 73, "dew_point": 19, "storage_humidity": 69, "storage_time_hour": 38,
    },
    {
        "lot_id": "LOT-2026-0528-AM-01", "measured_at": _days_ago_at(2, 10, 10),
        "factory_temp": 24, "factory_humidity": 55, "dew_point": 13, "storage_humidity": 50, "storage_time_hour": 16,
    },
    {
        "lot_id": "LOT-2026-0528-PM-01", "measured_at": _days_ago_at(2, 15, 0),
        "factory_temp": 26, "factory_humidity": 58, "dew_point": 16, "storage_humidity": 52, "storage_time_hour": 24,
    },
    {
        "lot_id": "LOT-2026-0529-AM-01", "measured_at": _days_ago_at(3, 11, 0),
        "factory_temp": 22, "factory_humidity": 50, "dew_point": 11, "storage_humidity": 48, "storage_time_hour": 18,
    },
]

# ---------------------------------------------------------------------------
# 5.5 不具合（ダッシュボードを初期から意味のある状態にするための履歴。
#   主役ロット LOT-2026-0527-PM-01 には敢えて登録しない＝デモで作成する）
# ---------------------------------------------------------------------------
DEFECTS = [
    {
        "lot_id": "LOT-2026-0527-AM-01", "defect_type": "白錆", "defect_count": 9, "inspected_count": 1000,
        "found_at_process": "外観検査", "temporary_action": "対象ロット隔離", "note": "梱包前の外観で点状の白錆を確認",
        "created_at": _days_ago_at(1, 11, 10), "status": "approved",
    },
    {
        "lot_id": "LOT-2026-0528-AM-01", "defect_type": "メッキムラ", "defect_count": 22, "inspected_count": 1200,
        "found_at_process": "工程内検査", "temporary_action": "ライン確認依頼", "note": "バレル下部にムラ傾向",
        "created_at": _days_ago_at(2, 10, 40), "status": "approved",
    },
    {
        "lot_id": "LOT-2026-0528-PM-01", "defect_type": "黒ずみ", "defect_count": 6, "inspected_count": 500,
        "found_at_process": "外観検査", "temporary_action": "再検査依頼", "note": "黒染め色調にバラつき",
        "created_at": _days_ago_at(2, 15, 30), "status": "report_generated",
    },
    {
        "lot_id": "LOT-2026-0529-AM-01", "defect_type": "メッキムラ", "defect_count": 14, "inspected_count": 600,
        "found_at_process": "出荷検査", "temporary_action": "保留", "note": "光沢にムラ",
        "created_at": _days_ago_at(3, 11, 30), "status": "registered",
    },
    {
        "lot_id": "LOT-2026-0527-AM-01", "defect_type": "白っぽい変色", "defect_count": 5, "inspected_count": 1000,
        "found_at_process": "外観検査", "temporary_action": "再検査依頼", "note": "ごく一部に変色",
        "created_at": _days_ago_at(1, 12, 5), "status": "investigated",
    },
]

# ---------------------------------------------------------------------------
# 5.7 ナレッジ（承認済みの確定事例）13件
#   亜鉛メッキ・炭素鋼・バレルの事例ほど主役ロットへの参考度が高くなるよう設計。
#
#   recurrence_status は対策実施後のライフサイクル状態（本日 2026-05-28 基準）:
#     - 監視中  : action_implemented_at から監視期間(90日)未満、または満了未確定
#     - 再発なし: 監視期間を満了し再発が確認されなかった（≦2026-02-27 作成のみ）
#     - 再発あり: 対策後に同一原因が再発（recurred_lot_id / recurrence_ref_case_id で根拠）
#   action_implemented_at は監視開始（ここでは created_at と同日）とする。
# ---------------------------------------------------------------------------
KNOWLEDGE_CASES = [
    {
        "product_id": "SCR-2041", "defect_type": "白っぽい変色", "confirmed_cause": "乾燥不足",
        "effective_action": "乾燥炉設定温度を95℃へ是正し温度アラームを追加", "recurrence_status": "再発なし",
        "summary": "夏季の湿度上昇時に乾燥炉温度が低下し水分が残存。白っぽい変色が発生した。",
        "created_at": _day(107), "surface_treatment": "亜鉛メッキ", "material": "炭素鋼",
        "process_name": "バレル亜鉛メッキ", "key_parameters": "drying_temp,factory_humidity",
        "action_implemented_at": _day(107), "recurrence_checked_at": _day(13),
    },
    {
        "product_id": "SCR-2041", "defect_type": "白化", "confirmed_cause": "水洗不足",
        "effective_action": "オーバーフロー量を15L/minへ増加し水洗水を定期交換", "recurrence_status": "監視中",
        "summary": "水洗槽の導電率上昇により残留塩が乾燥後に白化した。",
        "created_at": _day(84), "surface_treatment": "亜鉛メッキ", "material": "炭素鋼",
        "process_name": "バレル亜鉛メッキ", "key_parameters": "rinse_conductivity,rinse_overflow_rate",
        "action_implemented_at": _day(84),
    },
    {
        "product_id": "SCR-2042", "defect_type": "白錆", "confirmed_cause": "乾燥不足",
        "effective_action": "乾燥時間を25分→30分へ延長", "recurrence_status": "再発なし",
        "summary": "小ねじは水切れが悪く乾燥不足で白錆。乾燥時間延長で改善した。",
        "created_at": _day(95), "surface_treatment": "亜鉛メッキ", "material": "炭素鋼",
        "process_name": "バレル亜鉛メッキ", "key_parameters": "drying_temp,drying_time_min",
        "action_implemented_at": _day(95), "recurrence_checked_at": _day(1),
    },
    {
        # 監視期間(90日)を超過しているが再発判定が未確定の例＝「監視満了→確定可」を実演する。
        "product_id": "SCR-2041", "defect_type": "メッキムラ", "confirmed_cause": "電流密度低下",
        "effective_action": "バレル接点を清掃し回転数を是正", "recurrence_status": "監視中",
        "summary": "接点不良によりバレル内通電が低下しメッキムラが発生した。",
        "created_at": _day(130), "surface_treatment": "亜鉛メッキ", "material": "炭素鋼",
        "process_name": "バレル亜鉛メッキ", "key_parameters": "current_density",
        "action_implemented_at": _day(130),
    },
    {
        "product_id": "SCR-2041", "defect_type": "白錆", "confirmed_cause": "水洗不足",
        "effective_action": "水洗工程を2段から3段へ見直し", "recurrence_status": "再発あり",
        "summary": "水洗不足由来の白錆。3段水洗化で大幅改善も繁忙期に一部再発。",
        "created_at": _day(61), "surface_treatment": "亜鉛メッキ", "material": "炭素鋼",
        "process_name": "バレル亜鉛メッキ", "key_parameters": "rinse_conductivity",
        "action_implemented_at": _day(61), "recurrence_checked_at": _day(18),
        "recurred_lot_id": "LOT-2026-0508-AM-02",
        "recurrence_note": "繁忙期に水洗水交換が滞り、同一原因(水洗不足)で白錆が再発。3段化のみでは不十分。",
    },
    {
        "product_id": "SCR-2042", "defect_type": "白っぽい変色", "confirmed_cause": "乾燥不足",
        "effective_action": "乾燥炉ヒーターを交換し定期保守を計画化", "recurrence_status": "監視中",
        "summary": "乾燥炉ヒーター劣化で温度低下、白っぽい変色が発生した。",
        "created_at": _day(46), "surface_treatment": "亜鉛メッキ", "material": "炭素鋼",
        "process_name": "バレル亜鉛メッキ", "key_parameters": "drying_temp",
        "action_implemented_at": _day(46),
    },
    {
        "product_id": "SCR-2042", "defect_type": "密着不良", "confirmed_cause": "脱脂不足",
        "effective_action": "脱脂液濃度と温度の管理幅を厳格化", "recurrence_status": "再発なし",
        "summary": "脱脂不足で油分が残存しメッキ密着不良となった。",
        "created_at": _day(118), "surface_treatment": "亜鉛メッキ", "material": "炭素鋼",
        "process_name": "バレル亜鉛メッキ", "key_parameters": "degreasing_temp,degreasing_concentration",
        "action_implemented_at": _day(118), "recurrence_checked_at": _day(23),
    },
    {
        "product_id": "SCR-2041", "defect_type": "膜厚不足", "confirmed_cause": "電流密度低下",
        "effective_action": "電流値を再設定し電流ログ監視を追加", "recurrence_status": "監視中",
        "summary": "電流密度低下で膜厚不足。電流監視強化で改善した。",
        "created_at": _day(33), "surface_treatment": "亜鉛メッキ", "material": "炭素鋼",
        "process_name": "バレル亜鉛メッキ", "key_parameters": "current_density,plating_time_min",
        "action_implemented_at": _day(33),
    },
    {
        "product_id": "SCR-2041", "defect_type": "黒ずみ", "confirmed_cause": "乾燥不足",
        "effective_action": "乾燥後の滞留時間を短縮し搬送を見直し", "recurrence_status": "監視中",
        "summary": "乾燥後に高湿度環境で滞留したため黒ずみが発生した。",
        "created_at": _day(26), "surface_treatment": "亜鉛メッキ", "material": "炭素鋼",
        "process_name": "バレル亜鉛メッキ", "key_parameters": "drying_temp,storage_humidity",
        "action_implemented_at": _day(26),
    },
    {
        # 低参考度（ステンレス・不動態化）
        "product_id": "SCR-2043", "defect_type": "変色", "confirmed_cause": "酸洗い過多",
        "effective_action": "酸洗時間を短縮し液濃度を管理", "recurrence_status": "再発なし",
        "summary": "ステンレスの不動態化前の酸洗過多で変色。亜鉛メッキとは条件が異なる。",
        "created_at": _day(112), "surface_treatment": "不動態化処理", "material": "ステンレス",
        "process_name": "非メッキ", "key_parameters": "acid_pickling_time_sec",
        "action_implemented_at": _day(112), "recurrence_checked_at": _day(17),
    },
    {
        # 低参考度（黒染め）
        "product_id": "SCR-2044", "defect_type": "色ムラ", "confirmed_cause": "黒染め液濃度低下",
        "effective_action": "黒染め液を補給し濃度を管理", "recurrence_status": "監視中",
        "summary": "黒染め液濃度低下で色ムラ。黒染め特有の事象で亜鉛メッキとは異なる。",
        "created_at": _day(74), "surface_treatment": "黒染め", "material": "炭素鋼",
        "process_name": "黒染め", "key_parameters": "—",
        "action_implemented_at": _day(74),
    },
    {
        # 低参考度（亜鉛ニッケル・ラック）
        "product_id": "SCR-2045", "defect_type": "光沢ムラ", "confirmed_cause": "添加剤不足",
        "effective_action": "添加剤を補給し自動補給装置を検討", "recurrence_status": "再発あり",
        "summary": "亜鉛ニッケルメッキの添加剤不足で光沢ムラ。処理方式が異なる。",
        "created_at": _day(56), "surface_treatment": "亜鉛ニッケルメッキ", "material": "炭素鋼",
        "process_name": "ラックメッキ", "key_parameters": "additive_concentration",
        "action_implemented_at": _day(56), "recurrence_checked_at": _day(16),
        "recurred_lot_id": "LOT-2026-0510-RK-01",
        "recurrence_note": "添加剤の手動補給では管理が安定せず、同一原因(添加剤不足)で光沢ムラが再発。",
    },
    {
        # 中〜低参考度（同じ乾燥不足だが表面処理が異なる）
        "product_id": "SCR-2045", "defect_type": "変色", "confirmed_cause": "乾燥不足",
        "effective_action": "乾燥炉温度を是正", "recurrence_status": "監視中",
        "summary": "亜鉛ニッケルメッキ品の乾燥不足による変色。表面処理が異なるため参考度は中〜低。",
        "created_at": _day(38), "surface_treatment": "亜鉛ニッケルメッキ", "material": "炭素鋼",
        "process_name": "ラックメッキ", "key_parameters": "drying_temp",
        "action_implemented_at": _day(38),
    },
]


def _insert(conn: sqlite3.Connection, table: str, rows: list[dict]) -> None:
    """dict のリストを汎用的に INSERT する。"""
    if not rows:
        return
    for row in rows:
        cols = ", ".join(row.keys())
        placeholders = ", ".join(["?"] * len(row))
        conn.execute(
            f"INSERT INTO {table} ({cols}) VALUES ({placeholders})",
            list(row.values()),
        )


def clear_all(conn: sqlite3.Connection) -> None:
    """全テーブルを空にする（再投入のため）。"""
    for table in (
        models.INVESTIGATION_RESULTS,
        models.DEFECTS,
        models.PROCESS_PARAMETERS,
        models.ENVIRONMENT_PARAMETERS,
        models.KNOWLEDGE_CASES,
        models.LOTS,
        models.PRODUCTS,
    ):
        conn.execute(f"DELETE FROM {table}")
    # AUTOINCREMENT のカウンタもリセット（存在すれば）
    conn.execute("DELETE FROM sqlite_sequence")


def seed_database(reset: bool = True) -> dict:
    """サンプルデータを投入する。reset=True なら既存データを消してから入れる。"""
    init_db()
    conn = get_connection()
    try:
        if reset:
            clear_all(conn)
        _insert(conn, models.PRODUCTS, PRODUCTS)
        _insert(conn, models.LOTS, LOTS)
        _insert(conn, models.PROCESS_PARAMETERS, PROCESS_PARAMETERS)
        _insert(conn, models.ENVIRONMENT_PARAMETERS, ENVIRONMENT_PARAMETERS)
        _insert(conn, models.DEFECTS, DEFECTS)
        _insert(conn, models.KNOWLEDGE_CASES, KNOWLEDGE_CASES)
        conn.commit()
        counts = {
            "products": len(PRODUCTS),
            "lots": len(LOTS),
            "process_parameters": len(PROCESS_PARAMETERS),
            "environment_parameters": len(ENVIRONMENT_PARAMETERS),
            "defects": len(DEFECTS),
            "knowledge_cases": len(KNOWLEDGE_CASES),
        }
        return counts
    finally:
        conn.close()


def export_seed_json(path: str) -> None:
    """サンプルデータを JSON へ書き出す（tools/sample_data/seed_data.json 用）。"""
    data = {
        "products": PRODUCTS,
        "lots": LOTS,
        "process_parameters": PROCESS_PARAMETERS,
        "environment_parameters": ENVIRONMENT_PARAMETERS,
        "defects": DEFECTS,
        "knowledge_cases": KNOWLEDGE_CASES,
    }
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    counts = seed_database(reset=True)
    print("サンプルデータを投入しました:")
    for k, v in counts.items():
        print(f"  - {k}: {v} 件")
