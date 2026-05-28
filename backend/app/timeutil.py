"""日時ユーティリティ。

コンテナ(python:slim)の既定タイムゾーンは UTC のため、`datetime.now()` をそのまま
使うと日本時間より9時間遅れ、日付が前日になることがある。
日本にはサマータイムが無いので、固定オフセット +9（JST）で常に正しく扱える。
（tzdata のインストールやコンテナの TZ 設定に依存しない。）
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

# 日本標準時（UTC+9・サマータイム無し）
JST = timezone(timedelta(hours=9), "JST")


def now_jst() -> datetime:
    """現在の日本時間（タイムゾーン付き datetime）を返す。"""
    return datetime.now(JST)


def now_str(fmt: str = "%Y-%m-%d %H:%M") -> str:
    """現在の日本時間を文字列で返す（既定: 'YYYY-MM-DD HH:MM'）。"""
    return now_jst().strftime(fmt)


def days_since(dt_str: Optional[str]) -> Optional[int]:
    """日時文字列('YYYY-MM-DD' または 'YYYY-MM-DD HH:MM')から現在(JST)までの経過日数。

    パースできない/未設定なら None。負にはならない（最小0）。
    """
    if not dt_str:
        return None
    s = dt_str.strip()
    fmt = "%Y-%m-%d %H:%M" if " " in s else "%Y-%m-%d"
    try:
        dt = datetime.strptime(s, fmt).replace(tzinfo=JST)
    except ValueError:
        return None
    return max(0, (now_jst() - dt).days)
