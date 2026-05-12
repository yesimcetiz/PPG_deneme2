import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import engine, Base
from app.core.config import settings
from app.core.logging import RequestLoggingMiddleware, logger
from app.routers import auth, profile, ppg, admin, chat, debug


# Alembic migration'larını otomatik uygula (eksik kolonları ekler)
def run_migrations():
    import os
    from alembic.config import Config
    from alembic import command

    base_dir = os.path.dirname(os.path.dirname(__file__))
    alembic_cfg = Config(os.path.join(base_dir, "alembic.ini"))
    alembic_cfg.set_main_option(
        "script_location", os.path.join(base_dir, "alembic")
    )
    try:
        command.upgrade(alembic_cfg, "head")
        logger.info("✓ Alembic migrations uygulandı.")
    except Exception as e:
        logger.warning(f"Migration uyarısı (ilk kurulumda normal): {e}")
        # Fallback: create_all
        Base.metadata.create_all(bind=engine, checkfirst=True)
        logger.info("✓ DB tabloları create_all ile kontrol edildi.")


run_migrations()

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
