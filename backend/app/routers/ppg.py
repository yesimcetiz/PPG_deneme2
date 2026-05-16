from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import numpy as np

from app.core.database import get_db
from app.models.user import User, PPGResult, UserBaseline
from app.schemas.auth import PPGResultResponse
from app.services.auth_service import get_current_user
from app.services.ppg_service import run_inference, run_ble_inference

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


# ─── BLE → ML endpoint ───────────────────────────────────────

class BleAnalyzeRequest(BaseModel):
    """ESP32 BLE JSON'dan gelen 5 feature."""
    hr:       float   # MeanHR (bpm)
    rmssd:    float   # RMSSD (ms)
    sdnn:     float   # SDNN (ms)
    mean_nn:  float   # MeanNN (ms)
    motion:   float   # motion_std (g)


class BleAnalyzeResponse(BaseModel):
    p_stress:          float   # 0.0 – 1.0
    stress_level:      str     # "relaxed" | "moderate" | "high"
    stress_score:      int     # 0 – 100
    session_id:        str
    analyzed_at:       str
    baseline_sessions: int


@router.post("/analyze-ble", response_model=BleAnalyzeResponse)
def analyze_ble(
    data: BleAnalyzeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    ESP32 BLE'den gelen 5 feature ile Railway ML modelini çalıştırır.

    1. Kullanıcının baseline'ını DB'den çek
    2. Eksik robust9_z feature'larını matematiksel olarak türet
    3. Kişisel baseline'a göre Z-normalize et
    4. Logistic Regression → p_stress
    5. Sonucu ppg_results'a kaydet ve döndür
    """
    # ── 1. Baseline ──────────────────────────────────────────
    bl = db.query(UserBaseline).filter(UserBaseline.user_id == current_user.id).first()
    if bl is None:
        raise HTTPException(
            status_code=428,
            detail="Baseline bulunamadı. Önce Profil → Baseline Kalibrasyonu yapın."
        )

    # ── 2. Son 4 tahmini çek (majority smooth için) ──────────
    recent = (
        db.query(PPGResult.y_pred_raw)
        .filter(PPGResult.user_id == current_user.id)
        .order_by(PPGResult.created_at.desc())
        .limit(4)
        .all()
    )
    recent_preds = [r[0] for r in reversed(recent)]

    # ── 3. ML inference (ppg_service'e delege et) ────────────
    try:
        ml = run_ble_inference(
            hr=data.hr, rmssd=data.rmssd, sdnn=data.sdnn,
            mean_nn=data.mean_nn, motion=data.motion,
            bl_mean_nn_mean=bl.mean_nn_mean or 0.0,  bl_mean_nn_std=bl.mean_nn_std or 1.0,
            bl_sdnn_mean=bl.sdnn_mean or 0.0,         bl_sdnn_std=bl.sdnn_std or 1.0,
            bl_rmssd_mean=bl.rmssd_mean or 0.0,       bl_rmssd_std=bl.rmssd_std or 1.0,
            bl_mean_hr_mean=bl.mean_hr_mean or 0.0,   bl_mean_hr_std=bl.mean_hr_std or 1.0,
            bl_motion_mean=bl.motion_std_mean or 0.0, bl_motion_std=bl.motion_std_std or 1.0,
            recent_raw_preds=recent_preds,
        )
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"ML inference hatası: {e}")

    # ── 4. Kaydet ────────────────────────────────────────────
    result = PPGResult(
        user_id          = current_user.id,
        p_stress         = ml["p_stress"],
        y_pred_raw       = ml["y_pred_raw"],
        y_pred_smooth    = ml["y_pred_smooth"],
        feature_set_used = f"BLE-{ml['feature_set']}",
        mean_hr          = data.hr,
        sdnn             = data.sdnn,
        rmssd            = data.rmssd,
        mean_nn          = data.mean_nn,
        session_phase    = "BLE-ML",
        notes            = f"motion={data.motion:.4f}",   # ble-log için
    )
    db.add(result)
    db.commit()
    db.refresh(result)

    return BleAnalyzeResponse(
        p_stress          = ml["p_stress"],
        stress_level      = ml["stress_level"],
        stress_score      = ml["stress_score"],
        session_id        = str(result.id),
        analyzed_at       = result.created_at.isoformat() + "Z",
        baseline_sessions = bl.n_sessions,
    )


# ─── BLE Monitor log endpoint ─────────────────────────────────

@router.get("/ble-log")
def get_ble_log(
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Son BLE-ML oturumlarını live.py formatında döner.
    ble_monitor.py bu endpoint'i polling yaparak yerel log dosyasına yazar.
    """
    results = (
        db.query(PPGResult)
        .filter(
            PPGResult.user_id   == current_user.id,
            PPGResult.session_phase == "BLE-ML",
        )
        .order_by(PPGResult.created_at.desc())
        .limit(limit)
        .all()
    )
    out = []
    for r in reversed(results):   # kronolojik sıra
        # notes alanından motion'ı parse et (yoksa 0)
        motion = 0.0
        if r.notes and r.notes.startswith("motion="):
            try:
                motion = float(r.notes.split("=")[1])
            except ValueError:
                pass
        level_map = {2: "high", 1: "moderate", 0: "relaxed"}
        smooth_val = int(r.y_pred_smooth) if r.y_pred_smooth is not None else 0
        raw_val    = int(r.y_pred_raw)    if r.y_pred_raw    is not None else 0
        out.append({
            "session_id":   str(r.id),
            "analyzed_at":  r.created_at.isoformat() + "Z",
            "p_stress":     round(float(r.p_stress), 4),
            "y_pred_raw":   raw_val,
            "y_pred_smooth":smooth_val,
            "stress_level": level_map.get(smooth_val, "relaxed"),
            "hr":           round(float(r.mean_hr  or 0), 1),
            "rmssd":        round(float(r.rmssd    or 0), 1),
            "sdnn":         round(float(r.sdnn     or 0), 1),
            "mean_nn":      round(float(r.mean_nn  or 0), 1),
            "motion":       round(motion, 4),
        })
    return out