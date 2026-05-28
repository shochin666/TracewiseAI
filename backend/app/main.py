"""
FastAPI エントリポイント

起動時に DB を初期化し、空ならサンプルデータを投入する。
フロントエンド（Next.js, http://localhost:3000）からの CORS を許可する。
"""
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import get_connection, init_db
from .routers import analysis, dashboard, defects, environment, knowledge, lots, reports
from .seed import seed_database


def _seed_if_empty() -> None:
    """DBが空（製品0件）ならサンプルデータを投入する。"""
    init_db()
    conn = get_connection()
    try:
        count = conn.execute("SELECT COUNT(*) AS c FROM products").fetchone()["c"]
    finally:
        conn.close()
    if count == 0:
        counts = seed_database(reset=True)
        print(f"[startup] サンプルデータを投入しました: {counts}")
    else:
        print(f"[startup] 既存データを使用します（products={count}）")


@asynccontextmanager
async def lifespan(app: FastAPI):
    _seed_if_empty()
    yield


app = FastAPI(
    title="ねじメッキ工程 不具合登録・AI原因分析システム",
    description="QRコードでロットを特定し、工程データから原因候補と報告書を自動生成するデモAPI",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS（フロントエンドの開発サーバを許可）
frontend_origin = os.environ.get("FRONTEND_ORIGIN", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_origin],
    allow_origin_regex=r"http://localhost:\d+",  # 任意ポートのlocalhostを許可
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ルーター登録
for r in (
    lots.router, defects.router, analysis.router, reports.router,
    dashboard.router, knowledge.router, environment.router,
):
    app.include_router(r)


@app.get("/", tags=["meta"])
def root():
    return {
        "name": "ねじメッキ工程 不具合登録・AI原因分析システム API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/health",
    }


@app.get("/api/health", tags=["meta"])
def health():
    conn = get_connection()
    try:
        products = conn.execute("SELECT COUNT(*) AS c FROM products").fetchone()["c"]
        defects_c = conn.execute("SELECT COUNT(*) AS c FROM defects").fetchone()["c"]
        knowledge_c = conn.execute("SELECT COUNT(*) AS c FROM knowledge_cases").fetchone()["c"]
    finally:
        conn.close()
    return {"status": "ok", "products": products, "defects": defects_c, "knowledge_cases": knowledge_c}


@app.post("/api/admin/reseed", tags=["meta"])
def reseed():
    """デモを初期状態に戻す（サンプルデータを再投入）。"""
    counts = seed_database(reset=True)
    return {"status": "reseeded", "counts": counts}
