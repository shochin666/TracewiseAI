"""
DB接続とスキーマ初期化

sqlite3 を薄くラップする。各リクエストごとに接続を開き、辞書ライクに
行を扱えるよう Row ファクトリを設定する。
"""
from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from typing import Iterator

from .models import SCHEMA_SQL

# DBファイルの場所。環境変数で上書き可能（docker等で /app/data に置く）。
DEFAULT_DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "tracewise.db")
DB_PATH = os.environ.get("TRACEWISE_DB_PATH", DEFAULT_DB_PATH)


def _ensure_parent_dir(path: str) -> None:
    parent = os.path.dirname(path)
    if parent and not os.path.exists(parent):
        os.makedirs(parent, exist_ok=True)


def get_connection() -> sqlite3.Connection:
    """sqlite3 接続を生成する。row_factory により dict ライクにアクセスできる。"""
    _ensure_parent_dir(DB_PATH)
    # check_same_thread=False: FastAPIの同期エンドポイントはスレッドプールで実行され、
    # 依存性(get_db_session)の生成と finally のクローズが別スレッドになり得るため。
    # リクエストごとに別接続を開く設計なので、無効化しても安全。
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    # 外部キー制約を有効化
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


@contextmanager
def get_db() -> Iterator[sqlite3.Connection]:
    """汎用のコンテキストマネージャ（スクリプト等から使う）。"""
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_db_session() -> Iterator[sqlite3.Connection]:
    """FastAPI の Depends 用ジェネレータ依存性。リクエストごとに接続を開閉する。"""
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    """テーブルを作成する（存在しなければ）。"""
    conn = get_connection()
    try:
        conn.executescript(SCHEMA_SQL)
        conn.commit()
    finally:
        conn.close()


def row_to_dict(row: sqlite3.Row | None) -> dict | None:
    """sqlite3.Row を通常の dict に変換する。"""
    if row is None:
        return None
    return {k: row[k] for k in row.keys()}


def rows_to_list(rows: list[sqlite3.Row]) -> list[dict]:
    return [row_to_dict(r) for r in rows]
