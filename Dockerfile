# Railway deployment Dockerfile
# Build context: repo kökü (/)
# Bu yüzden backend/ path'ini açıkça belirtiyoruz

FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc && rm -rf /var/lib/apt/lists/*

# backend/requirements.txt'i kopyala (FastAPI + uvicorn burada)
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Sadece backend kodunu kopyala
COPY backend/ .

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
