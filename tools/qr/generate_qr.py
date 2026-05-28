#!/usr/bin/env python3
"""
QRコード生成スクリプト

lots.csv を読み込み、各ロットについて
  - QRコード画像        : output/{lot_id}_qr.png
  - ラベル印刷用の画像  : output/{lot_id}_label.png
を生成する。

QRコードの中身（読み取るとこのURLが開く）:
    {BASE_URL}/defects/new?lot_id={lot_id}
例:
    http://localhost:3000/defects/new?lot_id=LOT-2026-0527-PM-01

使い方:
    cd tools/qr
    python generate_qr.py --base-url http://localhost:3000
    # BASE_URL 環境変数でも指定可能:
    BASE_URL=http://192.168.0.10:3000 python generate_qr.py

依存:
    pip install "qrcode[pil]"
"""
from __future__ import annotations

import argparse
import csv
import os
from urllib.parse import quote

import qrcode
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_CSV = os.path.join(HERE, "lots.csv")
DEFAULT_OUT = os.path.join(HERE, "output")

# 日本語が描画できるフォント候補（OSによって異なる）。見つかればラベルに日本語を使う。
JP_FONT_CANDIDATES = [
    "/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc",
    "/System/Library/Fonts/ヒラギノ角ゴシック W4.ttc",
    "/System/Library/Fonts/Hiragino Sans GB.ttc",
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    "/Library/Fonts/Arial Unicode.ttf",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJKjp-Regular.otf",
    "/usr/share/fonts/truetype/noto/NotoSansCJKjp-Regular.otf",
    "C:/Windows/Fonts/meiryo.ttc",
    "C:/Windows/Fonts/msgothic.ttc",
]


def find_jp_font_path() -> str | None:
    for path in JP_FONT_CANDIDATES:
        if os.path.exists(path):
            return path
    return None


def load_font(font_path: str | None, size: int):
    """日本語フォントがあればそれを、なければPILの既定フォントを返す。"""
    if font_path:
        try:
            return ImageFont.truetype(font_path, size)
        except Exception:
            pass
    try:
        # PIL同梱のDejaVu（ASCII用）。無ければ最終フォールバック。
        return ImageFont.truetype("DejaVuSans.ttf", size)
    except Exception:
        return ImageFont.load_default()


def build_url(base_url: str, lot_id: str) -> str:
    base = base_url.rstrip("/")
    return f"{base}/defects/new?lot_id={quote(lot_id)}"


def make_qr_image(data: str, box_size: int = 10, border: int = 2) -> Image.Image:
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=box_size,
        border=border,
    )
    qr.add_data(data)
    qr.make(fit=True)
    return qr.make_image(fill_color="#0f172a", back_color="white").convert("RGB")


def make_label_image(
    lot_id: str,
    product_id: str,
    product_name: str,
    label_title: str,
    url: str,
    qr_img: Image.Image,
    jp_font_path: str | None,
) -> Image.Image:
    """通い箱・トレー等に貼るラベル風のPNGを作る。"""
    W, H = 460, 640
    canvas = Image.new("RGB", (W, H), "white")
    draw = ImageDraw.Draw(canvas)

    has_jp = jp_font_path is not None
    f_title = load_font(jp_font_path, 30)
    f_lot = load_font(jp_font_path, 26)
    f_text = load_font(jp_font_path, 20)
    f_small = load_font(jp_font_path, 13)

    # 外枠とヘッダ帯
    draw.rectangle([6, 6, W - 6, H - 6], outline="#1d4ed8", width=4)
    draw.rectangle([6, 6, W - 6, 70], fill="#1d4ed8")
    title = label_title if has_jp else "LOT LABEL"
    draw.text((24, 22), title, font=f_title, fill="white")

    # QRコード（中央）
    qr_size = 300
    qr_resized = qr_img.resize((qr_size, qr_size))
    qr_x = (W - qr_size) // 2
    canvas.paste(qr_resized, (qr_x, 96))

    # ロットID（ASCIIなのでフォントに依存せず描画可）
    y = 96 + qr_size + 16
    draw.text((24, y), lot_id, font=f_lot, fill="#0f172a")
    y += 40

    if has_jp:
        draw.text((24, y), f"品番: {product_id}　{product_name}", font=f_text, fill="#334155")
        y += 30
        draw.text((24, y), "スマホでQRを読み取り → 不具合登録", font=f_small, fill="#64748b")
        y += 22
    else:
        # 日本語フォントが無い環境ではASCIIのみ
        draw.text((24, y), f"P/N: {product_id}", font=f_text, fill="#334155")
        y += 30
        draw.text((24, y), "Scan QR to register defect", font=f_small, fill="#64748b")
        y += 22

    # URL（折り返し表示）
    draw.text((24, y), url[:48], font=f_small, fill="#94a3b8")
    if len(url) > 48:
        draw.text((24, y + 18), url[48:96], font=f_small, fill="#94a3b8")

    return canvas


def main() -> None:
    parser = argparse.ArgumentParser(description="ロットQRコード・ラベル一括生成")
    parser.add_argument(
        "--base-url",
        default=os.environ.get("BASE_URL", "http://localhost:3000"),
        help="QRに埋め込むベースURL（既定: http://localhost:3000、環境変数 BASE_URL でも指定可）",
    )
    parser.add_argument("--csv", default=DEFAULT_CSV, help="入力CSV（既定: lots.csv）")
    parser.add_argument("--out", default=DEFAULT_OUT, help="出力先ディレクトリ（既定: output/）")
    args = parser.parse_args()

    os.makedirs(args.out, exist_ok=True)
    jp_font = find_jp_font_path()
    print(f"BASE_URL = {args.base_url}")
    print(f"日本語フォント: {jp_font or '（見つからず → ラベルはASCII表記）'}")

    with open(args.csv, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    if not rows:
        print("CSVに行がありません。")
        return

    for row in rows:
        lot_id = row["lot_id"].strip()
        product_id = row.get("product_id", "").strip()
        product_name = row.get("product_name", "").strip()
        label_title = row.get("label_title", "ラベル").strip()
        url = build_url(args.base_url, lot_id)

        qr_img = make_qr_image(url)
        qr_path = os.path.join(args.out, f"{lot_id}_qr.png")
        qr_img.save(qr_path)

        label = make_label_image(lot_id, product_id, product_name, label_title, url, qr_img, jp_font)
        label_path = os.path.join(args.out, f"{lot_id}_label.png")
        label.save(label_path)

        print(f"  生成: {os.path.basename(qr_path)} / {os.path.basename(label_path)}  ->  {url}")

    print(f"\n完了: {len(rows)} ロット分のQR・ラベルを {args.out} に出力しました。")


if __name__ == "__main__":
    main()
