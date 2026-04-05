from fastapi import FastAPI
from app.api import stress

app = FastAPI(title="Stress Analyzer API")

app.include_router(stress.router, prefix="/stress", tags=["stress"])

@app.get("/")
def root():
    return {"message": "API çalışıyor ✅"}