"""
データモデル定義（SQLite DDL）

このシステムは sqlite3 を直接利用する。本モジュールではテーブルの
スキーマ（DDL）とテーブル名・カラム名の定数を一元管理する。
SQLAlchemy は使わず、薄い構成にして「仕組みが誰でも分かる」ことを優先する。
"""

# テーブル名定数（タイプミス防止のため定数化）
PRODUCTS = "products"
LOTS = "lots"
PROCESS_PARAMETERS = "process_parameters"
ENVIRONMENT_PARAMETERS = "environment_parameters"
DEFECTS = "defects"
INVESTIGATION_RESULTS = "investigation_results"
KNOWLEDGE_CASES = "knowledge_cases"


# スキーマ定義（CREATE TABLE 群）
# 要件 5.x のデータモデルに準拠する。
SCHEMA_SQL = """
-- 5.1 製品マスタ
CREATE TABLE IF NOT EXISTS products (
    product_id              TEXT PRIMARY KEY,
    product_name            TEXT,
    screw_type              TEXT,
    material                TEXT,
    surface_treatment       TEXT,
    plating_type            TEXT,
    size                    TEXT,
    length_mm               INTEGER,
    customer                TEXT,
    critical_characteristics TEXT,
    process_route           TEXT
);

-- 5.2 ロット（QRコードのキーになる単位）
CREATE TABLE IF NOT EXISTS lots (
    lot_id        TEXT PRIMARY KEY,
    product_id    TEXT,
    work_order_id TEXT,
    quantity      INTEGER,
    process_name  TEXT,
    equipment_id  TEXT,
    start_time    TEXT,
    end_time      TEXT,
    status        TEXT,
    FOREIGN KEY (product_id) REFERENCES products(product_id)
);

-- 5.3 工程パラメータ（自動取得される処理条件）
CREATE TABLE IF NOT EXISTS process_parameters (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    lot_id                  TEXT,
    measured_at             TEXT,
    degreasing_temp         REAL,
    degreasing_concentration REAL,
    acid_pickling_time_sec  INTEGER,
    rinse_conductivity      REAL,
    rinse_overflow_rate     REAL,
    bath_temp               REAL,
    bath_ph                 REAL,
    zinc_concentration      REAL,
    additive_concentration  REAL,
    current_density         REAL,
    plating_time_min        INTEGER,
    chromate_time_sec       INTEGER,
    drying_temp             REAL,
    drying_time_min         INTEGER,
    FOREIGN KEY (lot_id) REFERENCES lots(lot_id)
);

-- 5.4 環境パラメータ（工場・保管環境）
CREATE TABLE IF NOT EXISTS environment_parameters (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    lot_id          TEXT,
    measured_at     TEXT,
    factory_temp    REAL,
    factory_humidity REAL,
    dew_point       REAL,
    storage_humidity REAL,
    storage_time_hour REAL,
    FOREIGN KEY (lot_id) REFERENCES lots(lot_id)
);

-- 5.5 不具合（現場担当者が登録する事実）
CREATE TABLE IF NOT EXISTS defects (
    defect_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    lot_id           TEXT,
    defect_type      TEXT,
    defect_count     INTEGER,
    inspected_count  INTEGER,
    found_at_process TEXT,
    temporary_action TEXT,
    note             TEXT,
    created_at       TEXT,
    status           TEXT,
    FOREIGN KEY (lot_id) REFERENCES lots(lot_id)
);

-- 5.6 確認結果（原因候補に対する現場/品質の確認結果）
CREATE TABLE IF NOT EXISTS investigation_results (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    defect_id  INTEGER,
    check_item TEXT,
    result     TEXT,
    note       TEXT,
    FOREIGN KEY (defect_id) REFERENCES defects(defect_id)
);

-- 5.7 ナレッジ（承認済みの確定事例）
--   recurrence_status は対策実施後のライフサイクル状態:
--     監視中 → 再発なし / 再発あり（後日判定）。
--   action_implemented_at = 監視開始（承認時刻）。recurrence_checked_at = 判定日時。
CREATE TABLE IF NOT EXISTS knowledge_cases (
    case_id          INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id       TEXT,
    defect_type      TEXT,
    confirmed_cause  TEXT,
    effective_action TEXT,
    recurrence_status TEXT,
    summary          TEXT,
    created_at       TEXT,
    surface_treatment TEXT,
    material         TEXT,
    process_name     TEXT,
    key_parameters   TEXT,
    action_implemented_at TEXT,   -- 対策実施＝監視開始日時（通常は承認時刻）
    recurrence_checked_at TEXT,   -- 再発有無を確定した日時（監視中は NULL）
    recurrence_note       TEXT,   -- 再発判定の補足（再発したロット等）
    recurred_lot_id       TEXT,   -- 再発を検知したロット
    recurrence_ref_case_id INTEGER -- 再発の根拠となった新規事例ID
);
"""

# defects.status の取りうる値（要件 5.5）
DEFECT_STATUS = (
    "registered",       # 登録直後
    "analyzing",        # 分析中
    "investigated",     # 確認結果入力済み
    "report_generated", # 報告書生成済み
    "approved",         # 品質担当者が承認（ナレッジ化済み）
)

# investigation_results.result の取りうる値（要件 5.6）
INVESTIGATION_RESULT = ("abnormal", "normal", "unchecked", "not_applicable")

# knowledge_cases.recurrence_status のライフサイクル状態
#   監視中: 対策実施済み・経過観察中（承認直後の既定）
#   再発なし: 監視期間を満了し再発が確認されなかった（原因・対策とも検証済み）
#   再発あり: 対策後に同じ不具合が再発（原因は妥当だが対策が不十分）
RECURRENCE_MONITORING = "監視中"
RECURRENCE_NONE = "再発なし"
RECURRENCE_YES = "再発あり"
RECURRENCE_STATUS = (RECURRENCE_MONITORING, RECURRENCE_NONE, RECURRENCE_YES)
# 「再発なし」を提案するまでの監視期間（日）。これを超えた監視中の事例は確定可能とみなす。
MONITORING_WINDOW_DAYS = 90
