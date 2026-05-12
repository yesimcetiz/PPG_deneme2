import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import engine, Base
from app.core.config import settings
from app.core.logging import RequestLoggingMiddleware, logger
from app.routers import auth, profile, ppg, admin, chat, debug


# DB kurulumu: tablolar + eksik kolonlar
def setup_database():
    from sqlalchemy import text, inspect

    # 1. Tabloları oluştur (yoksa)
    Base.metadata.create_all(bind=engine, checkfirst=True)
    logger.info("✓ DB tabloları kontrol edildi.")

    # 2. Eksik kolonları doğrudan ekle (migration olmadan)
    with engine.connect() as conn:
        insp = inspect(engine)
        users_cols = [c["name"] for c in insp.get_columns("users")]

        if "refresh_token_hash" not in users_cols:
            conn.execute(text(
                "ALTER TABLE users ADD COLUMN refresh_token_hash VARCHAR"
            ))
            conn.execute(text(
                "ALTER TABLE users ADD COLUMN refresh_token_expires_at "
                "TIMESTAMP WITH TIME ZONE"
            ))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_users_refresh_token_hash "
                "ON users (refresh_token_hash)"
            ))
            conn.commit()
            logger.info("✓ refresh_token kolonları eklendi.")
        else:
            logger.info("✓ refresh_token kolonları zaten mevcut.")


setup_database()

# Production'da Swagger UI'ı kapat (güvenlik)
app = FastAPI(
    title="Stress Less API",
    description="PPG tabanlı stres tespit ve sağlık asistanı",
    version="1.0.0",
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
)

app.add_middleware(RequestLoggingMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,   # .env'den okunur
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(profile.router)
app.include_router(ppg.router)
app.include_router(admin.router)
app.include_router(chat.router)

# Debug router sadece development'ta aktif
if not settings.is_production:
    app.include_router(debug.router)
    logger.info("🔧 Debug router aktif (development modu)")


@app.get("/health")
def health_check():
    return {
        "status":      "ok",
        "service":     "stress-less-backend",
        "version":     "1.0.0",
        "environment": settings.ENVIRONMENT,
    }
