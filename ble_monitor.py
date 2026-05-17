#!/usr/bin/env python3
"""
BLE ML Monitor
──────────────────────────────────────────────────────────────────
ESP32 → BLE → Telefon → Railway ML pipeline çıktılarını
yerel log dosyasına yazar.

Kullanım (önerilen — şifre shell history'ye girmez):
  1. Proje kökünde .env.monitor dosyası oluştur:
       BLE_EMAIL=yesimcetiz@gmail.com
       BLE_PASSWORD=sifreniz
  2. Çalıştır:
       python ble_monitor.py

Alternatif (eski yöntem, hâlâ çalışır):
  python ble_monitor.py --email <email> --password <sifre>

Seçenekler:
  --interval  Polling aralığı saniye cinsinden (varsayılan: 5)
  --output    Log dosyası adı (varsayılan: ble_ml_detail.log)

Çıktı formatı:
  [14:32:10] p=0.257 raw=0 smooth=0 [relaxed] | HR=134.0 RMSSD=203.0 SDNN=197.1 MeanNN=445.3 motion=0.0066
"""

import argparse
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

try:
    import requests
except ImportError:
    sys.exit("❌ 'requests' paketi bulunamadı. Çalıştır: pip install requests")

# ─── .env.monitor yükle (varsa) ──────────────────────────────
_env_file = Path(__file__).parent / ".env.monitor"
if _env_file.exists():
    with _env_file.open() as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                _key, _, _val = _line.partition("=")
                os.environ.setdefault(_key.strip(), _val.strip())

BASE_URL = "https://ppgdeneme2-production.up.railway.app"


# ─── Auth ────────────────────────────────────────────────────

def login(email: str, password: str) -> str:
    r = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": email, "password": password},
        timeout=10,
    )
    r.raise_for_status()
    return r.json()["access_token"]


# ─── Fetch ───────────────────────────────────────────────────

def fetch_ble_log(token: str, limit: int = 100) -> list:
    r = requests.get(
        f"{BASE_URL}/ppg/ble-log?limit={limit}",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10,
    )
    r.raise_for_status()
    return r.json()


# ─── Format ──────────────────────────────────────────────────

def format_line(entry: dict) -> str:
    ts_str  = entry["analyzed_at"]
    # Timezone-aware parse
    ts      = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
    t_local = ts.astimezone()          # sistem saat dilimine çevir
    t_str   = t_local.strftime("%H:%M:%S")

    level   = entry["stress_level"]
    p       = entry["p_stress"]
    raw     = entry["y_pred_raw"]
    smooth  = entry["y_pred_smooth"]
    hr      = entry["hr"]
    rmssd   = entry["rmssd"]
    sdnn    = entry["sdnn"]
    mean_nn = entry["mean_nn"]
    motion  = entry["motion"]

    return (
        f"[{t_str}] p={p:.3f} raw={raw} smooth={smooth} [{level}] "
        f"| HR={hr} RMSSD={rmssd} SDNN={sdnn} MeanNN={mean_nn} motion={motion:.4f}"
    )


# ─── Main ────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="BLE ML Monitor — Railway log takibi")
    parser.add_argument("--email",    default=None, help="E-posta (.env.monitor'dan da okunur)")
    parser.add_argument("--password", default=None, help="Şifre  (.env.monitor'dan da okunur)")
    parser.add_argument("--interval", type=int, default=5,               help="Polling aralığı (saniye)")
    parser.add_argument("--output",   default="ble_ml_detail.log",       help="Çıktı log dosyası")
    args = parser.parse_args()

    # Öncelik sırası: --arg > .env.monitor > hata
    email    = args.email    or os.environ.get("BLE_EMAIL")
    password = args.password or os.environ.get("BLE_PASSWORD")

    if not email or not password:
        sys.exit(
            "❌ E-posta ve şifre gerekli.\n"
            "   Seçenek 1 (önerilen): Proje kökünde .env.monitor oluştur:\n"
            "     BLE_EMAIL=yesimcetiz@gmail.com\n"
            "     BLE_PASSWORD=sifreniz\n"
            "   Seçenek 2: python ble_monitor.py --email <e> --password <p>"
        )

    log_path = Path(args.output)

    print(f"🔐 Giriş yapılıyor: {email}")
    try:
        token = login(args.email, args.password)
    except Exception as e:
        sys.exit(f"❌ Giriş başarısız: {e}")

    print(f"✅ Bağlandı. Log dosyası: {log_path.resolve()}")
    print(f"⏱  Polling aralığı: {args.interval}s")
    print("─" * 72)

    seen_ids: set[str] = set()
    session_header = (
        f"\n{'─'*72}\n"
        f"[SESSION START {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}]\n"
        f"{'─'*72}\n"
    )

    with log_path.open("a", buffering=1, encoding="utf-8") as log:
        log.write(session_header)
        print(session_header.strip())

        while True:
            try:
                entries = fetch_ble_log(token, limit=100)
                for entry in entries:
                    sid = entry["session_id"]
                    if sid not in seen_ids:
                        seen_ids.add(sid)
                        line = format_line(entry)
                        print(line)
                        log.write(line + "\n")

            except requests.HTTPError as e:
                if e.response is not None and e.response.status_code == 401:
                    # Token süresi doldu — yeniden giriş
                    try:
                        token = login(email, password)
                    except Exception as re_err:
                        print(f"[WARN] Yeniden giriş başarısız: {re_err}")
                else:
                    print(f"[WARN] HTTP hatası: {e}")
            except requests.ConnectionError:
                print(f"[WARN] Bağlantı yok — {args.interval}s sonra tekrar denenecek")
            except Exception as e:
                print(f"[WARN] {e}")

            time.sleep(args.interval)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⏹  Monitor durduruldu.")
