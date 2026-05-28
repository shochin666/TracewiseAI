# 開発モード用イメージ（--reload でホットリロード）
FROM python:3.11-slim

WORKDIR /app

# 依存だけ先に入れる（requirements.txt を変えた時だけ再ビルドが必要）
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# ソースは compose 側でマウントするが、単体起動でも動くようコピーしておく
COPY app ./app

ENV TRACEWISE_DB_PATH=/app/data/tracewise.db
ENV FRONTEND_ORIGIN=http://localhost:3000

EXPOSE 8000

# 起動時に空ならサンプル投入。--reload でコード変更を即反映。
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
