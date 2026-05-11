"""
chat_service.py — Google Gemini 2.0 Flash ile sağlık asistanı.

Güvenlik:
- API key loglanmaz, yalnızca runtime'da kullanılır
- Sağlık verileri yalnızca aktif istek sırasında promptta yer alır
- BUG-011 fix: Lazy initialization — import sırasında değil, ilk çağrıda başlatılır
"""

import google.generativeai as genai
from app.core.config import settings

MAX_USER_MSG_LEN = 2000
MAX_HISTORY_TURNS = 20

SYSTEM_PROMPT_TEMPLATE = """Sen Stress Less uygulamasının kişisel sağlık asistanısın.
Kullanıcının sağlık profiline ve güncel PPG ölçüm sonuçlarına erişimin var.
Her zaman Türkçe kullan. Samimi, anlaşılır ve destekleyici ol.
Tıbbi tavsiye değil, bilgilendirici destek sağla. Ciddi durumlarda doktora yönlendir.

=== KULLANICI SAĞLIK PROFİLİ ===
{health_context}
=== SON PPG ÖLÇÜM SONUÇLARI ===
{ppg_context}
================================

Bu bilgileri cevaplarını kişiselleştirmek için kullan, doğrudan kullanıcıya söyleme."""

# BUG-011 fix: lazy init — modül import zamanında değil, ilk kullanımda başlatılır
_model = None


def _get_model():
    global _model
    if _model is None:
        if not settings.GEMINI_API_KEY:
            raise RuntimeError("GEMINI_API_KEY ayarlanmamış. .env dosyasını kontrol edin.")
        genai.configure(api_key=settings.GEMINI_API_KEY)
        _model = genai.GenerativeModel(settings.GEMINI_MODEL)
    return _model


def _build_system_prompt(health_context: dict | None, ppg_context: dict | None) -> str:
    hc_lines = []
    if health_context:
        if health_context.get("medications"):
            hc_lines.append(f"İlaçlar: {health_context['medications']}")
        if health_context.get("diagnoses"):
            hc_lines.append(f"Tanılar: {health_context['diagnoses']}")
        if health_context.get("allergies"):
            hc_lines.append(f"Alerjiler: {health_context['allergies']}")
        if health_context.get("stress_source"):
            hc_lines.append(f"Stres kaynağı: {health_context['stress_source']}")
        if health_context.get("avg_stress_level") is not None:
            hc_lines.append(f"Ortalama stres seviyesi (1-10): {health_context['avg_stress_level']}")
    hc_text = "\n".join(hc_lines) if hc_lines else "Profil henüz doldurulmamış."

    ppg_lines = []
    if ppg_context:
        if ppg_context.get("latest_stress_level"):
            ppg_lines.append(f"Stres seviyesi: {ppg_context['latest_stress_level']}")
        if ppg_context.get("latest_heart_rate") is not None:
            ppg_lines.append(f"Kalp hızı: {ppg_context['latest_heart_rate']} bpm")
        if ppg_context.get("latest_hrv_rmssd") is not None:
            ppg_lines.append(f"HRV (RMSSD): {ppg_context['latest_hrv_rmssd']} ms")
    ppg_text = "\n".join(ppg_lines) if ppg_lines else "Henüz ölçüm yapılmamış."

    return SYSTEM_PROMPT_TEMPLATE.format(
        health_context=hc_text,
        ppg_context=ppg_text,
    )


def chat_with_gemini(
    message: str,
    conversation_history: list[dict],
    health_context: dict | None = None,
    ppg_context: dict | None = None,
) -> str:
    message = message[:MAX_USER_MSG_LEN]
    system_prompt = _build_system_prompt(health_context, ppg_context)

    gemini_history = []
    for turn in conversation_history[-MAX_HISTORY_TURNS:]:
        role = "user" if turn.get("role") == "user" else "model"
        gemini_history.append({
            "role": role,
            "parts": [turn.get("content", "")],
        })

    model = _get_model()
    chat = model.start_chat(history=gemini_history)
    full_message = f"{system_prompt}\n\nKullanıcı: {message}"
    response = chat.send_message(full_message)
    return response.text.strip()
