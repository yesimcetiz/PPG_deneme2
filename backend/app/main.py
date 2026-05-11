from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import engine, Base
from app.routers import auth, profile, ppg, admin

# Tabloları oluştur (production'da alembic kullan)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="PPG Stres Tespit API",
    description="Antigravity PPG mobil uygulaması backend servisi",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # production'da mobil app domain'ini kısıtla
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(profile.router)
app.include_router(ppg.router)
app.include_router(admin.router)


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "ppg-backend"}