"""
報告書下書き生成（AI風）

analysis_engine の分析結果と確認結果から、報告書の下書きを組み立てる。
要件 8 の例文スタイルに沿い、原因を断定せず「最有力候補」「確定が必要」と表現する。
"""
from __future__ import annotations

from typing import Any, Optional

from .models import RECURRENCE_NONE, RECURRENCE_YES
from .timeutil import now_str

RESULT_LABELS = {
    "abnormal": "異常あり",
    "normal": "異常なし",
    "unchecked": "未確認",
    "not_applicable": "該当なし",
}


def _abnormal_params(analysis: dict) -> list[dict]:
    """異常・警告のパラメータだけを抽出する。"""
    items = []
    for grp in ("process_parameters", "environment_parameters"):
        for p in analysis.get(grp, []):
            if p.get("status") in ("abnormal", "warning"):
                items.append(p)
    return items


def _param_phrase(p: dict) -> str:
    label = p.get("label")
    value = p.get("value")
    unit = p.get("unit") or ""
    if p.get("status") == "abnormal":
        return f"{label}の異常（{value}{unit}）"
    return f"{label}の管理限界寄り（{value}{unit}）"


def _investigation_summary(investigation: list[dict]) -> dict:
    grouped: dict[str, list[dict]] = {"abnormal": [], "normal": [], "unchecked": [], "not_applicable": []}
    items = []
    for r in investigation:
        result = r.get("result", "unchecked")
        grouped.setdefault(result, []).append(r)
        items.append({
            "check_item": r.get("check_item"),
            "result": result,
            "result_label": RESULT_LABELS.get(result, result),
            "note": r.get("note", ""),
        })
    return {
        "items": items,
        "abnormal": grouped["abnormal"],
        "normal": grouped["normal"],
        "unchecked": grouped["unchecked"],
        "not_applicable": grouped["not_applicable"],
        "abnormal_count": len(grouped["abnormal"]),
        "checked_count": len(grouped["abnormal"]) + len(grouped["normal"]),
        "total": len(items),
    }


def _build_body_text(defect: dict, lot: dict, lead: Optional[dict], abnormal: list[dict], inv: dict) -> str:
    """要件8の例文スタイルで本文を生成する。"""
    lot_id = lot.get("lot_id", defect.get("lot_id"))
    dtype = defect.get("defect_type")
    count = defect.get("defect_count")
    inspected = defect.get("inspected_count")
    rate = round(count / inspected * 100, 2) if inspected else 0

    lines = [
        f"本件は、{lot_id} において{dtype}が発生した事象である"
        f"（発生数 {count} / 検査数 {inspected}、不良率 {rate}%）。"
    ]
    if abnormal:
        phrases = "、".join(_param_phrase(p) for p in abnormal[:4])
        lines.append(f"発生時刻周辺の工程・環境データを確認したところ、{phrases}が確認された。")
    else:
        lines.append("発生時刻周辺の工程・環境データに、管理基準を逸脱する明確な異常は確認されなかった。")

    if lead:
        lines.append(
            f"そのため、{lead['name']}が原因候補として最も{lead['level']}い"
            f"（{lead['confidence']}）。"
        )
        checks = "・".join(lead.get("check_items", [])[:3])
        lines.append(
            f"ただし、本内容は推定であり、{checks}の確認結果により確定する必要がある。"
        )
    else:
        lines.append("明確な原因候補は抽出されなかったため、現場での追加確認が必要である。")

    if inv.get("abnormal"):
        ab = "、".join(r.get("check_item", "") for r in inv["abnormal"][:3])
        lines.append(f"確認結果では「{ab}」で異常が確認されており、原因候補を裏づけている。")

    return "\n".join(lines)


def generate_report(analysis: dict, investigation: Optional[list[dict]] = None) -> dict:
    """分析結果と確認結果から報告書下書きを生成する。"""
    if investigation is None:
        investigation = analysis.get("investigation_results", []) or []

    defect = analysis.get("defect", {})
    lot = analysis.get("lot", {})
    product = analysis.get("product", {})
    candidates = analysis.get("cause_candidates", [])
    lead = candidates[0] if candidates else None
    abnormal = _abnormal_params(analysis)
    inv = _investigation_summary(investigation)

    count = defect.get("defect_count") or 0
    inspected = defect.get("inspected_count") or 0
    rate = round(count / inspected * 100, 2) if inspected else 0.0

    # 恒久対策・再発防止案（最有力候補のアクション＋過去事例の対策を再発状況で出し分け）
    #   再発なし → 検証済みとして推奨 / 監視中 → 経過観察中と明示 / 再発あり → 推奨せず警告へ
    permanent: list[str] = []
    prevention: list[str] = []
    action_cautions: list[str] = []
    if lead:
        permanent.append(lead["actions"]["permanent"])
        prevention.append(lead["actions"]["prevention"])
        for case in lead.get("reference_cases", [])[:3]:
            action = case.get("effective_action")
            if not action:
                continue
            cid = case.get("case_id")
            rec = case.get("recurrence_status")
            if rec == RECURRENCE_YES:
                action_cautions.append(
                    f"過去事例#{cid}では「{action}」を実施したが再発している。"
                    "同じ対策の踏襲では不十分な可能性があり、より強い恒久対策が必要。"
                )
            elif rec == RECURRENCE_NONE:
                permanent.append(f"（過去事例#{cid}で有効だった対策）{action}")
            else:  # 監視中
                permanent.append(f"（過去事例#{cid}で実施・効果は経過観察中）{action}")

    temporary = defect.get("temporary_action") or "—"
    if lead:
        temporary = f"{temporary} ／ {lead['actions']['temporary']}"

    title = f"不具合報告書（下書き）: {lot.get('lot_id', '')} {defect.get('defect_type', '')}"

    return {
        "title": title,
        "generated_at": now_str(),
        "is_draft": True,
        "body_text": _build_body_text(defect, lot, lead, abnormal, inv),
        "summary": {
            "lot_id": defect.get("lot_id"),
            "defect_type": defect.get("defect_type"),
            "found_at_process": defect.get("found_at_process"),
            "note": defect.get("note"),
            "created_at": defect.get("created_at"),
            "status": defect.get("status"),
        },
        "target_lot": lot,
        "target_product": product,
        "occurrence": {
            "defect_count": count,
            "inspected_count": inspected,
            "defect_rate": rate,
        },
        "abnormal_parameters": abnormal,
        "cause_candidates": candidates,
        "lead_cause": lead,
        "evidence": lead.get("evidences", []) if lead else [],
        "investigation_summary": inv,
        "temporary_action": temporary,
        "permanent_action_plan": permanent or ["原因確定後に恒久対策を立案する"],
        "action_cautions": action_cautions,
        "prevention_plan": prevention or ["原因確定後に再発防止策を立案する"],
        "reference_cases": analysis.get("similar_cases", [])[:5],
        "excluded_cases": analysis.get("excluded_cases", []),
        "approval": {
            "approver": None,
            "approved_at": None,
            "status": defect.get("status"),
        },
        "policy_note": (
            "承認済みの原因・対策だけが次回以降の原因候補提示に使われます。"
            "AIが勝手に真因を確定するのではなく、品質担当者の承認を通じてナレッジ化します。"
        ),
    }
