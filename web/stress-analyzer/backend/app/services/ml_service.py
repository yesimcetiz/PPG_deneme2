import joblib
import numpy as np
from pathlib import Path

MODEL_PATH = Path(__file__).parent.parent.parent / "ml_models" / "stress_model_logreg_4feat_motion_calibrated.pkl"

model = joblib.load(MODEL_PATH)

THR = 0.60

def predict_stress(features: dict) -> dict:
    MeanNN_rel = features["MeanNN"] / features["MeanNN_base"]
    SDNN_rel   = features["SDNN"]   / features["SDNN_base"]
    RMSSD_rel  = features["RMSSD"]  / features["RMSSD_base"]
    motion_rel = features["motion_std"] / features["motion_base"]

    X = np.array([[MeanNN_rel, SDNN_rel, RMSSD_rel, motion_rel]])

    p_stress = model.predict_proba(X)[0][1]
    label    = int(p_stress >= THR)

    return {
        "p_stress": round(float(p_stress), 4),
        "label": label,
        "threshold": THR
    }