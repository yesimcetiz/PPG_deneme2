from pathlib import Path
from collections import deque
import time
import math
import json
import datetime

import joblib
import numpy as np
import pandas as pd
import serial
import serial.tools.list_ports
import requests

try:
    from scipy.signal import welch
    SCIPY_OK = True
except Exception:
    SCIPY_OK = False


# ============================================================
# CONFIG
# ============================================================
BAUD = 115200

# ── Railway backend ──────────────────────────────────────────
RAILWAY_URL = "https://ppgdeneme2-production.up.railway.app"

_USERS = {
    "1": {"email": "yesimcetiz@gmail.com",  "password": "Stres2024", "name": "Yeşim"},
    "2": {"email": "ezgidokk04@gmail.com",  "password": "Stres2024", "name": "Ezgi"},
}
print("\nKullanıcı seçin:")
for k, v in _USERS.items():
    print(f"  {k}) {v['name']}")
_choice = input("Seçim (1/2): ").strip()
_user = _USERS.get(_choice, _USERS["1"])
LIVE_EMAIL    = _user["email"]
LIVE_PASSWORD = _user["password"]
print(f"✓ {_user['name']} olarak devam ediliyor.\n")

MODEL_PATH = Path("stress_model_logreg_best.pkl")
SEARCH_PATH = Path("LOSO_model_search_results.csv")

SUBJECT_ID = "live_subject_01"

# ── Kişisel baseline cache ────────────────────────────────────
BASELINE_CACHE_MAX_AGE_DAYS = 30   # bu kadar günden eskiyse yok say
BASELINE_CACHE_BLEND_WEIGHT = 0.6  # cache ağırlığı (0=sadece yeni, 1=sadece cache)

def _cache_path(email: str) -> Path:
    safe = email.replace("@", "_at_").replace(".", "_")
    return Path(f"baseline_cache_{safe}.json")

def load_baseline_cache(email: str):
    """Cache varsa (base_means, base_stds, n_sessions) döner, yoksa None."""
    import json
    from datetime import datetime, timezone
    p = _cache_path(email)
    if not p.exists():
        return None
    try:
        d = json.loads(p.read_text())
        age_days = (datetime.now(timezone.utc) -
                    datetime.fromisoformat(d["updated_at"])).days
        if age_days > BASELINE_CACHE_MAX_AGE_DAYS:
            print(f"[Cache] {age_days} gün eski, yok sayılıyor.")
            return None
        means = pd.Series(d["base_means"])
        stds  = pd.Series(d["base_stds"]).clip(lower=1e-6)
        n     = d.get("n_sessions", 1)
        print(f"[Cache] Kişisel baseline yüklendi ({n} oturum, {age_days} gün önce).")
        return means, stds, n
    except Exception as e:
        print(f"[Cache] Yüklenemedi: {e}")
        return None

def save_baseline_cache(email: str, means: pd.Series, stds: pd.Series, n_sessions: int):
    """Baseline istatistiklerini cache dosyasına kaydeder."""
    import json
    from datetime import datetime, timezone
    try:
        d = {
            "email": email,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "n_sessions": n_sessions,
            "base_means": means.to_dict(),
            "base_stds":  stds.to_dict(),
        }
        _cache_path(email).write_text(json.dumps(d, indent=2))
        print(f"[Cache] Kişisel baseline kaydedildi ({n_sessions}. oturum).")
    except Exception as e:
        print(f"[Cache] Kaydedilemedi: {e}")

# baseline capture duration
BASELINE_SEC = 90.0

# rolling inference
WINDOW_SEC = 20.0
STEP_SEC = 5.0
MIN_RR_COUNT = 6

# RR filtering
RR_MIN_MS = 300.0
RR_MAX_MS = 2000.0
MAX_RR_JUMP_FRAC = 0.50

# smoothing
K = 5
M = 3

# threshold
THR = 0.50

# optional logging
SAVE_WINDOWS = True
WINDOW_LOG_CSV = Path("live_windows_log.csv")
ML_DETAIL_LOG  = Path("live_ml_detail.log")   # canlı, her pencerede flush

# ── Kişisel baseline cache ────────────────────────────────────
BASELINE_CACHE_MAX_AGE_DAYS = 30   # bu kadar günden eski cache görmezden gelinir
BASELINE_CACHE_BLEND_WEIGHT = 0.6  # eski cache'e verilen ağırlık (0.4 = yeni oturum)


# ============================================================
# FEATURE SETS
# ============================================================
FEATURE_SETS = {
    "base4_z": [
        "MeanNN_z", "SDNN_z", "RMSSD_z", "motion_z"
    ],
    "robust7_z": [
        "MeanNN_z", "MedianNN_z", "SDNN_z", "RMSSD_z",
        "IQRNN_z", "MeanHR_z", "motion_z"
    ],
    "robust9_z": [
        "MeanNN_z", "MedianNN_z", "SDNN_z", "RMSSD_z",
        "IQRNN_z", "MADNN_z", "MeanHR_z", "StdHR_z", "motion_z"
    ],
    "freq10_z": [
        "MeanNN_z", "MedianNN_z", "SDNN_z", "RMSSD_z",
        "IQRNN_z", "MADNN_z", "MeanHR_z", "StdHR_z",
        "LFHF_log", "motion_z"
    ],
    "full12_z": [
        "MeanNN_z", "MedianNN_z", "SDNN_z", "RMSSD_z",
        "IQRNN_z", "MADNN_z", "MeanHR_z", "StdHR_z",
        "LF_power_log", "HF_power_log", "LFHF_log", "motion_z"
    ],
}


# ============================================================
# KİŞİSEL BASELINE CACHE
# ============================================================
def _cache_path(email: str) -> Path:
    safe = email.replace("@", "_at_").replace(".", "_")
    return Path(f"baseline_cache_{safe}.json")


def load_baseline_cache(email: str):
    """Kaydedilmiş kişisel baseline'ı yükler.
    Returns (means_series, stds_series, n_sessions) veya None."""
    p = _cache_path(email)
    if not p.exists():
        return None
    try:
        with open(p, "r") as f:
            data = json.load(f)
        saved_at = datetime.datetime.fromisoformat(data["saved_at"])
        age_days = (datetime.datetime.utcnow() - saved_at).days
        if age_days > BASELINE_CACHE_MAX_AGE_DAYS:
            print(f"[Cache] Eski cache ({age_days} gün) — görmezden geliniyor.")
            return None
        means = pd.Series(data["means"])
        stds  = pd.Series(data["stds"])
        n     = int(data.get("n_sessions", 1))
        print(f"[Cache] Kişisel baseline yüklendi ({n} oturum, {age_days} gün önce).")
        return means, stds, n
    except Exception as e:
        print(f"[Cache] Yükleme hatası: {e} — görmezden geliniyor.")
        return None


def save_baseline_cache(email: str, means: pd.Series, stds: pd.Series, n_sessions: int):
    """Baseline istatistiklerini JSON'a kaydeder."""
    p = _cache_path(email)
    try:
        data = {
            "saved_at": datetime.datetime.utcnow().isoformat(),
            "n_sessions": n_sessions,
            "means": means.to_dict(),
            "stds":  stds.to_dict(),
        }
        with open(p, "w") as f:
            json.dump(data, f, indent=2)
        print(f"[Cache] Kişisel baseline kaydedildi ({n_sessions}. oturum).")
    except Exception as e:
        print(f"[Cache] Kaydetme hatası: {e}")


# ============================================================
# PORT AUTO-DETECT
# ============================================================
def find_esp32_port() -> str:
    """USB'deki ESP32 portunu otomatik bulur."""
    keywords = ['usbmodem', 'usbserial', 'cp210', 'ch340', 'silicon', 'esp32']
    for p in serial.tools.list_ports.comports():
        combined = f"{p.device} {p.description} {p.hwid}".lower()
        if any(kw in combined for kw in keywords):
            print(f"✓ ESP32 portu bulundu: {p.device}")
            return p.device
    # Bulunamazsa mevcut portları listele
    ports = [p.device for p in serial.tools.list_ports.comports()]
    raise RuntimeError(
        f"ESP32 bulunamadı. Mevcut portlar: {ports}\n"
        "USB kablosunu kontrol edin ve tekrar deneyin."
    )


# ============================================================
# RAILWAY API
# ============================================================
_railway_token: str | None = None

def login_railway() -> bool:
    global _railway_token
    try:
        r = requests.post(
            f"{RAILWAY_URL}/auth/login",
            json={"email": LIVE_EMAIL, "password": LIVE_PASSWORD},
            timeout=10,
        )
        r.raise_for_status()
        _railway_token = r.json()["access_token"]
        print("✓ Railway login başarılı.")
        return True
    except Exception as e:
        print(f"⚠ Railway login hatası: {e} — sonuçlar sadece terminale yazılacak.")
        return False


def post_to_railway(feat: dict, p_stress: float, y_smooth: int) -> None:
    """ML sonucunu backend'e gönderir. Hata olursa sessizce geçer."""
    if _railway_token is None:
        return
    score = max(0, min(100, round(p_stress * 100)))
    level = "high" if score >= 65 else "moderate" if score >= 35 else "relaxed"
    try:
        requests.post(
            f"{RAILWAY_URL}/ppg/log",
            json={
                "heart_rate":  round(float(feat.get("MeanHR", 0)), 1),
                "hrv_rmssd":   round(float(feat.get("RMSSD", 0)), 1),
                "stress_score": score,
                "stress_level": level,
                "device_id":   "live.py-ML",
            },
            headers={"Authorization": f"Bearer {_railway_token}"},
            timeout=5,
        )
    except Exception as e:
        print(f"⚠ Railway post hatası: {e}")


# ============================================================
# HELPERS
# ============================================================
def median_abs_deviation(x: np.ndarray) -> float:
    if len(x) == 0:
        return np.nan
    med = np.median(x)
    return float(np.median(np.abs(x - med)))


def safe_z(x, mean, std, eps=1e-6):
    if pd.isna(mean):
        mean = 0.0
    if pd.isna(std) or abs(std) < eps:
        std = eps
    return (float(x) - float(mean)) / float(std)


def majority_smooth(binary_preds, k=5, m=3):
    out = []
    window = []
    for b in binary_preds:
        window.append(int(b))
        if len(window) > k:
            window.pop(0)
        out.append(1 if sum(window) >= m else 0)
    return np.array(out, dtype=int)


def compute_freq_features(rr_win_ms: np.ndarray):
    if (not SCIPY_OK) or len(rr_win_ms) < 8:
        return np.nan, np.nan, np.nan

    rr_s = rr_win_ms / 1000.0
    t_beats = np.cumsum(rr_s)
    t_beats = t_beats - t_beats[0]
    dur = t_beats[-1] - t_beats[0]

    if dur < 20.0:
        return np.nan, np.nan, np.nan

    fs = 4.0
    t_uniform = np.arange(0.0, dur, 1.0 / fs)
    if len(t_uniform) < 16:
        return np.nan, np.nan, np.nan

    rr_uniform = np.interp(t_uniform, t_beats, rr_s)
    rr_uniform = rr_uniform - np.mean(rr_uniform)

    f, pxx = welch(rr_uniform, fs=fs, nperseg=min(256, len(rr_uniform)))

    lf_band = (f >= 0.04) & (f < 0.15)
    hf_band = (f >= 0.15) & (f < 0.40)

    if not np.any(lf_band) or not np.any(hf_band):
        return np.nan, np.nan, np.nan

    lf_power = float(np.trapz(pxx[lf_band], f[lf_band]))
    hf_power = float(np.trapz(pxx[hf_band], f[hf_band]))
    lfhf = np.nan if hf_power <= 1e-12 else float(lf_power / hf_power)

    return lf_power, hf_power, lfhf


def load_best_feature_set(search_path: Path):
    search_df = pd.read_csv(search_path)
    best_cfg = search_df.sort_values(
        by=["stress_f1", "roc_auc", "weighted_f1"],
        ascending=False
    ).iloc[0]
    feat_name = best_cfg["feature_set"]
    return feat_name, FEATURE_SETS[feat_name]


def parse_line(line: str):
    parts = line.strip().split("\t")
    if len(parts) != 11:
        return None

    cols = [
        "time_ms", "ir", "ppg", "beat", "bpm", "avg_bpm", "finger",
        "ax", "ay", "az", "accmag"
    ]
    try:
        vals = [float(x) for x in parts]
        row = dict(zip(cols, vals))
        row["beat"] = int(row["beat"])
        row["finger"] = int(row["finger"])
        return row
    except Exception:
        return None


def compute_window_feature_row(raw_df: pd.DataFrame, beat_times_ms, rr_df: pd.DataFrame, win_start_ms, win_end_ms, phase_name):
    rr_win = rr_df[(rr_df["time_ms"] >= win_start_ms) & (rr_df["time_ms"] < win_end_ms)].copy()
    rr = rr_win["rr_ms"].to_numpy(dtype=float)

    if len(rr) < MIN_RR_COUNT:
        return None

    diff_rr = np.diff(rr)
    hr = 60000.0 / rr

    raw_seg = raw_df[(raw_df["time_ms"] >= win_start_ms) & (raw_df["time_ms"] < win_end_ms)].copy()
    if len(raw_seg) < 2:
        return None

    beat_count = int(((np.array(beat_times_ms) >= win_start_ms) & (np.array(beat_times_ms) < win_end_ms)).sum())
    beat_density = beat_count / ((win_end_ms - win_start_ms) / 1000.0)

    motion_std = float(raw_seg["accmag"].std(ddof=1)) if len(raw_seg) >= 2 else np.nan
    lf_power, hf_power, lfhf = compute_freq_features(rr)

    return {
        "subject": SUBJECT_ID,
        "phase": phase_name,
        "label": 0,
        "window_start": int(win_start_ms),

        "MeanNN": float(np.mean(rr)),
        "MedianNN": float(np.median(rr)),
        "IQRNN": float(np.percentile(rr, 75) - np.percentile(rr, 25)),
        "MADNN": float(median_abs_deviation(rr)),
        "SDNN": float(np.std(rr, ddof=1)) if len(rr) >= 2 else np.nan,
        "RMSSD": float(np.sqrt(np.mean(diff_rr ** 2))) if len(diff_rr) >= 1 else np.nan,

        "MeanHR": float(np.mean(hr)),
        "StdHR": float(np.std(hr, ddof=1)) if len(hr) >= 2 else np.nan,

        "LF_power": lf_power,
        "HF_power": hf_power,
        "LFHF": lfhf,

        "BeatDensity": float(beat_density),
        "motion_std": float(motion_std),
    }


# ============================================================
# LIVE STATE
# ============================================================
print("Loading model...")
model = joblib.load(MODEL_PATH)
best_feature_set, best_features = load_best_feature_set(SEARCH_PATH)
print(f"Best feature set: {best_feature_set}")
print(f"Features: {best_features}")

# ── ML detail log dosyasını aç (append, canlı flush) ────────
_ml_log = open(ML_DETAIL_LOG, "a", buffering=1)  # buffering=1 → satır bazlı flush
_ml_log.write(
    f"\n{'='*70}\n"
    f"SESSION START  {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
    f"User: {LIVE_EMAIL}  |  Feature set: {best_feature_set}\n"
    f"{'='*70}\n"
)

def _log(msg: str):
    """Terminal + log dosyasına aynı anda yazar."""
    print(msg)
    _ml_log.write(msg + "\n")

# Kişisel baseline cache yükle (varsa)
_cached_baseline = load_baseline_cache(LIVE_EMAIL)

# Railway login (opsiyonel — başarısız olursa sadece terminal çıktısı)
login_railway()

# ── Kişisel baseline cache yükle ─────────────────────────────
_cached_baseline = load_baseline_cache(LIVE_EMAIL)  # (means, stds, n) veya None

# Serial port otomatik tespit
PORT = find_esp32_port()
print(f"Opening serial: {PORT} @ {BAUD}")
ser = serial.Serial(PORT, BAUD, timeout=1)
time.sleep(2)

raw_rows = deque(maxlen=120000)      # plenty for several minutes at ~100 Hz
beat_times_ms = deque(maxlen=10000)
rr_rows = deque(maxlen=10000)

baseline_feature_rows = []
pred_history = []
window_log_rows = []

baseline_done = False
baseline_start_ms = None
last_processed_window_start = None
prev_good_rr = None
last_beat_time = None

print("\nStarting live inference.")
print(f"Baseline capture: {BASELINE_SEC:.0f} s")
print(f"Window: {WINDOW_SEC:.0f} s, step: {STEP_SEC:.0f} s")
print("Press Ctrl+C to stop.\n")

try:
    while True:
        line = ser.readline().decode("utf-8", errors="ignore").strip()
        if not line:
            continue

        row = parse_line(line)
        if row is None:
            continue

        t_ms = row["time_ms"]
        if baseline_start_ms is None:
            baseline_start_ms = t_ms

        raw_rows.append(row)

        # beat -> RR
        if row["beat"] == 1 and row["finger"] == 1:
            current_beat = t_ms
            beat_times_ms.append(current_beat)

            if last_beat_time is not None:
                rr = current_beat - last_beat_time
                accept = RR_MIN_MS <= rr <= RR_MAX_MS

                if accept and prev_good_rr is not None:
                    jump_frac = abs(rr - prev_good_rr) / max(prev_good_rr, 1e-6)
                    if jump_frac > MAX_RR_JUMP_FRAC:
                        accept = False

                if accept:
                    rr_rows.append({"time_ms": current_beat, "rr_ms": rr})
                    prev_good_rr = rr

            last_beat_time = current_beat

        # need enough raw history
        if len(raw_rows) < 10:
            continue

        raw_df = pd.DataFrame(list(raw_rows))
        rr_df = pd.DataFrame(list(rr_rows)) if len(rr_rows) > 0 else pd.DataFrame(columns=["time_ms", "rr_ms"])

        current_time_ms = float(raw_df["time_ms"].max())

        # baseline mode
        if not baseline_done:
            elapsed_sec = (current_time_ms - baseline_start_ms) / 1000.0
            if elapsed_sec >= WINDOW_SEC:
                # build baseline windows every STEP_SEC
                if last_processed_window_start is None:
                    last_processed_window_start = baseline_start_ms

                while last_processed_window_start + WINDOW_SEC * 1000.0 <= current_time_ms:
                    win_start = last_processed_window_start
                    win_end = win_start + WINDOW_SEC * 1000.0

                    feat = compute_window_feature_row(
                        raw_df, beat_times_ms, rr_df, win_start, win_end, phase_name="Base"
                    )
                    if feat is not None:
                        baseline_feature_rows.append(feat)

                    last_processed_window_start += STEP_SEC * 1000.0

            remaining = BASELINE_SEC - elapsed_sec
            if remaining > 0:
                print(f"\rCapturing baseline... {remaining:6.1f} s remaining", end="", flush=True)

            if elapsed_sec >= BASELINE_SEC:
                print()

                if len(baseline_feature_rows) == 0:
                    raise RuntimeError("Baseline finished but no valid baseline windows were created.")

                baseline_df = pd.DataFrame(baseline_feature_rows)
                base_feature_cols = [
                    "MeanNN", "MedianNN", "IQRNN", "MADNN",
                    "SDNN", "RMSSD",
                    "MeanHR", "StdHR",
                    "LF_power", "HF_power", "LFHF",
                    "BeatDensity", "motion_std"
                ]

                base_means = baseline_df[base_feature_cols].mean()
                base_stds  = baseline_df[base_feature_cols].std()

                # ── Kişisel cache ile blend ──────────────────
                if _cached_baseline is not None:
                    cached_means, cached_stds, n_prev = _cached_baseline
                    w = BASELINE_CACHE_BLEND_WEIGHT
                    common = [c for c in base_feature_cols if c in cached_means.index]
                    if common:
                        base_means[common] = w * cached_means[common] + (1 - w) * base_means[common]
                        base_stds[common]  = w * cached_stds[common]  + (1 - w) * base_stds[common]
                        base_stds = base_stds.clip(lower=1e-6)
                        print(f"[Cache] Önceki {n_prev} oturumla harmanlandı (ağırlık: {w}).")
                    n_sessions = n_prev + 1
                else:
                    n_sessions = 1
                save_baseline_cache(LIVE_EMAIL, base_means, base_stds, n_sessions)
                # ────────────────────────────────────────────

                # ── Cache ile blend: önceki oturumların bilgisini koru ──
                if _cached_baseline is not None:
                    cached_means, cached_stds, n_prev = _cached_baseline
                    w = BASELINE_CACHE_BLEND_WEIGHT
                    # Sadece ortak kolonlar için blend
                    common = [c for c in base_feature_cols if c in cached_means.index]
                    if common:
                        base_means[common] = w * cached_means[common] + (1 - w) * base_means[common]
                        base_stds[common]  = w * cached_stds[common]  + (1 - w) * base_stds[common]
                        base_stds = base_stds.clip(lower=1e-6)
                        print(f"[Cache] Kişisel norm ile blend edildi (ağırlık={w}).")
                    n_sessions = n_prev + 1
                else:
                    n_sessions = 1

                # Bu oturumun baseline'ını cache'e kaydet (blend edilmiş hali)
                save_baseline_cache(LIVE_EMAIL, base_means, base_stds, n_sessions)

                baseline_done = True
                _log(f"Baseline ready. Valid baseline windows: {len(baseline_feature_rows)}")
                _log("── Baseline means ──────────────────────────────────────")
                for col in ["MeanNN","SDNN","RMSSD","MeanHR","motion_std"]:
                    _log(f"  {col:15s}  mean={base_means[col]:8.2f}  std={base_stds[col]:8.4f}")
                _log("────────────────────────────────────────────────────────")
                _log("Live predictions started.\n")
            continue

        # live mode
        if last_processed_window_start is None:
            last_processed_window_start = current_time_ms - WINDOW_SEC * 1000.0

        while last_processed_window_start + WINDOW_SEC * 1000.0 <= current_time_ms:
            win_start = last_processed_window_start
            win_end = win_start + WINDOW_SEC * 1000.0

            feat = compute_window_feature_row(
                raw_df, beat_times_ms, rr_df, win_start, win_end, phase_name="Live"
            )
            last_processed_window_start += STEP_SEC * 1000.0

            if feat is None:
                continue

            # normalize like inference pipeline
            feat["MeanNN_z"] = safe_z(feat["MeanNN"], base_means["MeanNN"], base_stds["MeanNN"])
            feat["MedianNN_z"] = safe_z(feat["MedianNN"], base_means["MedianNN"], base_stds["MedianNN"])
            feat["IQRNN_z"] = safe_z(feat["IQRNN"], base_means["IQRNN"], base_stds["IQRNN"])
            feat["MADNN_z"] = safe_z(feat["MADNN"], base_means["MADNN"], base_stds["MADNN"])
            feat["SDNN_z"] = safe_z(feat["SDNN"], base_means["SDNN"], base_stds["SDNN"])
            feat["RMSSD_z"] = safe_z(feat["RMSSD"], base_means["RMSSD"], base_stds["RMSSD"])
            feat["MeanHR_z"] = safe_z(feat["MeanHR"], base_means["MeanHR"], base_stds["MeanHR"])
            feat["StdHR_z"] = safe_z(feat["StdHR"], base_means["StdHR"], base_stds["StdHR"])
            feat["BeatDensity_z"] = safe_z(feat["BeatDensity"], base_means["BeatDensity"], base_stds["BeatDensity"])
            feat["motion_z"] = safe_z(feat["motion_std"], base_means["motion_std"], base_stds["motion_std"])

            feat["LF_power_log"] = math.log1p(max(feat["LF_power"], 0.0)) if not pd.isna(feat["LF_power"]) else np.nan
            feat["HF_power_log"] = math.log1p(max(feat["HF_power"], 0.0)) if not pd.isna(feat["HF_power"]) else np.nan
            feat["LFHF_log"] = math.log1p(max(feat["LFHF"], 0.0)) if not pd.isna(feat["LFHF"]) else np.nan

            feat_df = pd.DataFrame([feat]).replace([np.inf, -np.inf], np.nan).dropna(subset=best_features)
            if len(feat_df) == 0:
                continue

            X = feat_df[best_features].to_numpy(dtype=float)
            p_stress = float(model.predict_proba(X)[:, 1][0])
            y_raw = int(p_stress >= THR)

            pred_history.append(y_raw)
            y_smooth = int(majority_smooth(pred_history, k=K, m=M)[-1])

            feat["p_stress"] = p_stress
            feat["y_pred_raw"] = y_raw
            feat["y_pred_smooth"] = y_smooth

            window_log_rows.append(feat)

            level = "HIGH    " if p_stress >= 0.65 else "moderate" if p_stress >= 0.35 else "relaxed "
            ts = datetime.datetime.now().strftime("%H:%M:%S")
            _log(
                f"[{ts}] p_stress={p_stress:.3f}  raw={y_raw}  smooth={y_smooth}  [{level}]\n"
                f"         Ham   → HR={feat['MeanHR']:6.1f}  RMSSD={feat['RMSSD']:6.1f}"
                f"  SDNN={feat['SDNN']:6.1f}  MeanNN={feat['MeanNN']:7.1f}  motion={feat['motion_std']:.4f}\n"
                f"         Z-val → HR_z={feat['MeanHR_z']:+.2f}  RMSSD_z={feat['RMSSD_z']:+.2f}"
                f"  SDNN_z={feat['SDNN_z']:+.2f}  MeanNN_z={feat['MeanNN_z']:+.2f}  motion_z={feat['motion_z']:+.2f}"
            )
            # Railway'e gönder → mobil uygulamada görünür
            post_to_railway(feat, p_stress, y_smooth)

except KeyboardInterrupt:
    print("\nStopping...")

finally:
    ser.close()

    if SAVE_WINDOWS and len(window_log_rows) > 0:
        pd.DataFrame(window_log_rows).to_csv(WINDOW_LOG_CSV, index=False)
        print(f"Saved live window log: {WINDOW_LOG_CSV}")

    _ml_log.write(
        f"\nSESSION END  {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        f"  |  Total windows: {len(window_log_rows)}\n"
    )
    _ml_log.close()
    print(f"Saved ML detail log: {ML_DETAIL_LOG}")