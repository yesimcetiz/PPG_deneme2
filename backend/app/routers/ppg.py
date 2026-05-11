from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import numpy as np

from app.core.database import get_db
from app.models.user import User, PPGResult
from app.schemas.auth import PPGResultResponse
from app.services.auth_service import get_current_user
from app.services.ppg_service import run_inference

router = APIRouter(prefix="/ppg", tags=["ppg"])


class PPGWindowFeatures(BaseModel):
    """Tek bir pencereden hesaplanan HRV özellikleri (converter.py çıktısı ile aynı format)."""
    MeanNN: float
    MedianNN: float
    IQRNN: float
    MADNN: float
    SDNN: float
    RMSSD: float
    MeanHR: float
    StdHR: float
    LF_power: Optional[float] = None
    HF_power: Optional[float] = None
    LFHF: Optional[float] = None
    BeatDensity: float
    motion_std: float


class BaselineStats(BaseModel):
    """Kullanıcının dinlenme baseline ortalaması ve std'si."""
    means: dict  # {"MeanNN": 850.0, ...}
    stds: dict   # {"MeanNN": 40.0, ...}


class InferenceRequest(BaseModel):
    windows: List[PPGWindowFeatures]
    baseline: BaselineStats
    session_phase: Optional[str] = "Live"
    notes: Optional[str] = None


class InferenceResponse(BaseModel):
    predictions: List[dict]  # [{window_idx, p_stress, y_pred_raw, y_pred_smooth}, ...]
    saved_result_id: Optional[int] = None


@router.post("/analyze", response_model=InferenceResponse)
def analyze_ppg(
    request: InferenceRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Mobil uygulamadan gelen HRV pencerelerini modele gönderir.
    Baseline normalizasyonu burada yapılır (inference.py ile aynı mantık).
    """
    try:
        predictions = run_inference(request.windows, request.baseline)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Inference hatası: {str(e)}")

    # Son pencerenin sonucunu DB'ye kaydet
    last = predictions[-1] if predictions else None
    saved_id = None
    if last:
        last_window = request.windows[-1]
        result = PPGResult(
            user_id=current_user.id,
            p_stress=last["p_stress"],
            y_pred_raw=last["y_pred_raw"],
            y_pred_smooth=last["y_pred_smooth"],
            feature_set_used=last.get("feature_set"),
            mean_hr=last_window.MeanHR,
            sdnn=last_window.SDNN,
            rmssd=last_window.RMSSD,
            mean_nn=last_window.MeanNN,
            session_phase=request.session_phase,
            notes=request.notes,
        )
        db.add(result)
        db.commit()
        db.refresh(result)
        saved_id = result.id

    return InferenceResponse(predictions=predictions, saved_result_id=saved_id)


@router.get("/results", response_model=List[PPGResultResponse])
def get_my_results(
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Kullanıcının geçmiş PPG sonuçları (ham format)."""
    return (
        db.query(PPGResult)
        .filter(PPGResult.user_id == current_user.id)
        .order_by(PPGResult.created_at.desc())
        .limit(limit)
        .all()
    )


@router.get("/history")
def get_my_history(
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Kullanıcının geçmiş PPG sonuçları — mobil PpgSessionSummary formatında.
    BUG-006 + BUG-008 fix: alan adları mobil ile eşleştirildi.
    """
    results = (
        db.query(PPGResult)
        .filter(PPGResult.user_id == current_user.id)
        .order_by(PPGResult.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "session_id": str(r.id),
            "heart_rate": round(r.mean_hr or 0, 1),
            "hrv_rmssd":  round(r.rmssd or 0, 1),
            "stress_level": "high" if r.y_pred_smooth == 1 else "relaxed",
            "stress_score": round(r.p_stress * 100),
            "analyzed_at": r.created_at.isoformat(),
        }
        for r in results
    ]