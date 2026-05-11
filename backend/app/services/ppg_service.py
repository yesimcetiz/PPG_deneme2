"""
PPG inference servisi.
inference.py ve live.py'deki normalizasyon + model tahmin mantığını
API'ye uygun hale getirir. Model dosyası ve feature set config'i
proje kökündeki ml_models/ klasöründen yüklenir.
"""
from pathlib import Path
from typing import List
import math
import numpy as np
import pandas as pd
import joblib

MODEL_DIR = Path(__file__).resolve().parents[3] / "ml_models"
MODEL_PATH = MODEL_DIR / "stress_model_logreg_best.pkl"
SEARCH_PATH = MODEL_DIR / "LOSO_model_search_results.csv"

FEATURE_SETS = {
    "base4_z": ["MeanNN_z", "SDNN_z", "RMSSD_z", "motion_z"],
    "robust7_z": ["MeanNN_z", "MedianNN_z", "SDNN_z", "RMSSD_z", "IQRNN_z", "MeanHR_z", "motion_z"],
    "robust9_z": ["MeanNN_z", "MedianNN_z", "SDNN_z", "RMSSD_z", "IQRNN_z", "MADNN_z", "MeanHR_z", "StdHR_z", "motion_z"],
    "freq10_z": ["MeanNN_z", "MedianNN_z", "SDNN_z", "RMSSD_z", "IQRNN_z", "MADNN_z", "MeanHR_z", "StdHR_z", "LFHF_log", "motion_z"],
    "full12_z": ["MeanNN_z", "MedianNN_z", "SDNN_z", "RMSSD_z", "IQRNN_z", "MADNN_z", "MeanHR_z", "StdHR_z", "LF_power_log", "HF_power_log", "LFHF_log", "motion_z"],
}

K, M, THR = 5, 3, 0.50

_model = None
_best_features = None
_feature_set_name = None


def _load_model():
    global _model, _best_features, _feature_set_name
    if _model is not None:
        return
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Model dosyası bulunamadı: {MODEL_PATH}")
    _model = joblib.load(MODEL_PATH)
    if SEARCH_PATH.exists():
        search_df = pd.read_csv(SEARCH_PATH)
        best = search_df.sort_values(["stress_f1", "roc_auc", "weighted_f1"], ascending=False).iloc[0]
        _feature_set_name = best["feature_set"]
    else:
        _feature_set_name = "robust9_z"
    _best_features = FEATURE_SETS[_feature_set_name]


def _safe_z(x, mean, std, eps=1e-6):
    if pd.isna(mean): mean = 0.0
    if pd.isna(std) or abs(std) < eps: std = eps
    return (float(x) - float(mean)) / float(std)


def _majority_smooth(binary_preds, k=5, m=3):
    out, window = [], []
    for b in binary_preds:
        window.append(int(b))
        if len(window) > k: window.pop(0)
        out.append(1 if sum(window) >= m else 0)
    return out


def run_inference(windows, baseline) -> list:
    _load_model()
    means = baseline.means
    stds = baseline.stds

    rows = []
    for w in windows:
        feat = w.model_dump()
        feat["MeanNN_z"]      = _safe_z(feat["MeanNN"],      means.get("MeanNN", 0),      stds.get("MeanNN", 1))
        feat["MedianNN_z"]    = _safe_z(feat["MedianNN"],    means.get("MedianNN", 0),    stds.get("MedianNN", 1))
        feat["IQRNN_z"]       = _safe_z(feat["IQRNN"],       means.get("IQRNN", 0),       stds.get("IQRNN", 1))
        feat["MADNN_z"]       = _safe_z(feat["MADNN"],       means.get("MADNN", 0),       stds.get("MADNN", 1))
        feat["SDNN_z"]        = _safe_z(feat["SDNN"],        means.get("SDNN", 0),        stds.get("SDNN", 1))
        feat["RMSSD_z"]       = _safe_z(feat["RMSSD"],       means.get("RMSSD", 0),       stds.get("RMSSD", 1))
        feat["MeanHR_z"]      = _safe_z(feat["MeanHR"],      means.get("MeanHR", 0),      stds.get("MeanHR", 1))
        feat["StdHR_z"]       = _safe_z(feat["StdHR"],       means.get("StdHR", 0),       stds.get("StdHR", 1))
        feat["motion_z"]      = _safe_z(feat["motion_std"],  means.get("motion_std", 0),  stds.get("motion_std", 1))

        lf = feat.get("LF_power") or 0.0
        hf = feat.get("HF_power") or 0.0
        lfhf = feat.get("LFHF") or 0.0
        feat["LF_power_log"]  = math.log1p(max(lf, 0.0))
        feat["HF_power_log"]  = math.log1p(max(hf, 0.0))
        feat["LFHF_log"]      = math.log1p(max(lfhf, 0.0))
        rows.append(feat)

    df = pd.DataFrame(rows).replace([np.inf, -np.inf], np.nan)
    missing = [f for f in _best_features if f not in df.columns]
    if missing:
        raise ValueError(f"Eksik feature'lar: {missing}")

    df_clean = df.dropna(subset=_best_features)
    if len(df_clean) == 0:
        raise ValueError("Tüm pencereler NaN sonrası düştü. Daha uzun kayıt gerekli.")

    X = df_clean[_best_features].to_numpy(dtype=float)
    p_stress = _model.predict_proba(X)[:, 1]
    y_raw = (p_stress >= THR).astype(int).tolist()
    y_smooth = _majority_smooth(y_raw, k=K, m=M)

    return [
        {
            "window_idx": i,
            "p_stress": float(p_stress[i]),
            "y_pred_raw": int(y_raw[i]),
            "y_pred_smooth": int(y_smooth[i]),
            "feature_set": _feature_set_name,
        }
        for i in range(len(df_clean))
    ]