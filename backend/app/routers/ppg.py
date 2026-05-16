from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import numpy as np

from app.core.database import get_db
from app.models.user import User, PPGResult, UserBaseline
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


# ─── Scenario B: ESP32 TinyML sonucunu kaydet ────────────────

class PpgLogRequest(BaseModel):
    """ESP32'den BLE üzerinden gelen işlenmiş sonuç."""
    heart_rate: float
    hrv_rmssd: float
    stress_score: float          # 0–100
    stress_level: str            # "relaxed" | "moderate" | "high"
    device_id: Optional[str] = None


@router.post("/log")
def log_ppg_result(
    data: PpgLogRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    ESP32 TinyML modelinin çıktısını backend'e kaydeder.
    Backend ML çalıştırmaz — sadece saklar ve session_id döner.
    Mobil: ppgApi.logResult() bu endpoint'i çağırır.
    """
    # stress_level → y_pred dönüşümü: high=2, moderate=1, relaxed=0
    level_map = {"high": 2, "moderate": 1, "relaxed": 0}
    y_pred = level_map.get(data.stress_level, 0)

    result = PPGResult(
        user_id=current_user.id,
        p_stress=data.stress_score / 100.0,
        y_pred_raw=y_pred,
        y_pred_smooth=y_pred,
        mean_hr=data.heart_rate,
        rmssd=data.hrv_rmssd,
        feature_set_used=f"ESP32-TinyML:{data.device_id}" if data.device_id else "ESP32-TinyML",
        session_phase="BLE",
    )
    db.add(result)
    db.commit()
    db.refresh(result)

    return {
        "session_id": str(result.id),
        "analyzed_at": result.created_at.isoformat() + "Z",
    }


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
            "stress_level": "high" if r.y_pred_smooth == 2 else "moderate" if r.y_pred_smooth == 1 else "relaxed",
            "stress_score": round(r.p_stress * 100),
            "analyzed_at": r.created_at.isoformat() + "Z",
        }
        for r in results
    ]


# ─── Baseline endpoints ──────────────────────────────────────

BASELINE_BLEND_WEIGHT = 0.6   # existing baseline ağırlığı (live.py ile aynı)

BASELINE_FIELDS = ["mean_nn", "sdnn", "rmssd", "mean_hr", "motion_std"]


class BaselineSessionRequest(BaseModel):
    """Tek kalibrasyon oturumundan hesaplanan istatistikler."""
    mean_nn_mean:    float
    mean_nn_std:     float
    sdnn_mean:       float
    sdnn_std:        float
    rmssd_mean:      float
    rmssd_std:       float
    mean_hr_mean:    float
    mean_hr_std:     float
    motion_std_mean: float
    motion_std_std:  float


class BaselineResponse(BaseModel):
    mean_nn_mean:    Optional[float]
    mean_nn_std:     Optional[float]
    sdnn_mean:       Optional[float]
    sdnn_std:        Optional[float]
    rmssd_mean:      Optional[float]
    rmssd_std:       Optional[float]
    mean_hr_mean:    Optional[float]
    mean_hr_std:     Optional[float]
    motion_std_mean: Optional[float]
    motion_std_std:  Optional[float]
    n_sessions:      int
    updated_at:      Optional[str]


@router.get("/baseline", response_model=BaselineResponse)
def get_baseline(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Kullanıcının kayıtlı baseline istatistiklerini döner. Yoksa 404."""
    bl = db.query(UserBaseline).filter(UserBaseline.user_id == current_user.id).first()
    if bl is None:
        raise HTTPException(status_code=404, detail="Baseline bulunamadı. Önce kalibrasyon yapın.")
    return BaselineResponse(
        mean_nn_mean=bl.mean_nn_mean,
        mean_nn_std=bl.mean_nn_std,
        sdnn_mean=bl.sdnn_mean,
        sdnn_std=bl.sdnn_std,
        rmssd_mean=bl.rmssd_mean,
        rmssd_std=bl.rmssd_std,
        mean_hr_mean=bl.mean_hr_mean,
        mean_hr_std=bl.mean_hr_std,
        motion_std_mean=bl.motion_std_mean,
        motion_std_std=bl.motion_std_std,
        n_sessions=bl.n_sessions,
        updated_at=bl.updated_at.isoformat() + "Z" if bl.updated_at else None,
    )


@router.post("/baseline", response_model=BaselineResponse)
def update_baseline(
    session: BaselineSessionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Yeni kalibrasyon oturumunu mevcut baseline ile blend eder ve kaydeder.
    İlk oturumda direkt kaydedilir. Sonraki oturumlarda:
      new_value = BLEND_WEIGHT * old_value + (1 - BLEND_WEIGHT) * session_value
    Bu mantık live.py::save_baseline_cache ile birebir aynıdır.
    """
    bl = db.query(UserBaseline).filter(UserBaseline.user_id == current_user.id).first()

    if bl is None:
        # İlk oturum — direkt kaydet
        bl = UserBaseline(
            user_id=current_user.id,
            mean_nn_mean=session.mean_nn_mean,
            mean_nn_std=session.mean_nn_std,
            sdnn_mean=session.sdnn_mean,
            sdnn_std=session.sdnn_std,
            rmssd_mean=session.rmssd_mean,
            rmssd_std=session.rmssd_std,
            mean_hr_mean=session.mean_hr_mean,
            mean_hr_std=session.mean_hr_std,
            motion_std_mean=session.motion_std_mean,
            motion_std_std=session.motion_std_std,
            n_sessions=1,
        )
        db.add(bl)
    else:
        w = BASELINE_BLEND_WEIGHT
        nw = 1.0 - w

        def _blend(old, new):
            if old is None:
                return new
            return w * old + nw * new

        bl.mean_nn_mean    = _blend(bl.mean_nn_mean,    session.mean_nn_mean)
        bl.mean_nn_std     = _blend(bl.mean_nn_std,     session.mean_nn_std)
        bl.sdnn_mean       = _blend(bl.sdnn_mean,       session.sdnn_mean)
        bl.sdnn_std        = _blend(bl.sdnn_std,        session.sdnn_std)
        bl.rmssd_mean      = _blend(bl.rmssd_mean,      session.rmssd_mean)
        bl.rmssd_std       = _blend(bl.rmssd_std,       session.rmssd_std)
        bl.mean_hr_mean    = _blend(bl.mean_hr_mean,    session.mean_hr_mean)
        bl.mean_hr_std     = _blend(bl.mean_hr_std,     session.mean_hr_std)
        bl.motion_std_mean = _blend(bl.motion_std_mean, session.motion_std_mean)
        bl.motion_std_std  = _blend(bl.motion_std_std,  session.motion_std_std)
        bl.n_sessions      = bl.n_sessions + 1

    db.commit()
    db.refresh(bl)

    return BaselineResponse(
        mean_nn_mean=bl.mean_nn_mean,
        mean_nn_std=bl.mean_nn_std,
        sdnn_mean=bl.sdnn_mean,
        sdnn_std=bl.sdnn_std,
        rmssd_mean=bl.rmssd_mean,
        rmssd_std=bl.rmssd_std,
        mean_hr_mean=bl.mean_hr_mean,
        mean_hr_std=bl.mean_hr_std,
        motion_std_mean=bl.motion_std_mean,
        motion_std_std=bl.motion_std_std,
        n_sessions=bl.n_sessions,
        updated_at=bl.updated_at.isoformat() + "Z" if bl.updated_at else None,
    )