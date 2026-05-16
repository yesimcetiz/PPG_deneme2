#!/bin/bash
# StressLess — live.py otomatik başlatıcı

cd /Users/yesim.cetiz/PPG_deneme2
PYTHON="/Users/yesim.cetiz/PPG_deneme2/venv/bin/python3.13"

# ESP32 bağlanana kadar bekle (max 60 saniye)
for i in $(seq 1 12); do
    PORT=$(ls /dev/cu.usbmodem* /dev/cu.usbserial* 2>/dev/null | head -1)
    if [ -n "$PORT" ]; then
        echo "$(date): ESP32 bulundu: $PORT — live.py başlıyor"
        break
    fi
    echo "$(date): ESP32 bekleniyor... ($i/12)"
    sleep 5
done

if [ -z "$PORT" ]; then
    echo "$(date): ESP32 bulunamadı, live.py başlatılamadı."
    exit 1
fi

"$PYTHON" /Users/yesim.cetiz/PPG_deneme2/live.py
