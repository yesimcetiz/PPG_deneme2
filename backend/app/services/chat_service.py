"""
chat_service.py — Google Gemini 2.0 Flash ile sağlık asistanı.

Güvenlik:
- API key loglanmaz, yalnızca runtime'da kullanılır
- Sağlık verileri yalnızca aktif istek sırasında promptta yer alır
- Lazy initialization — import sırasında değil, ilk çağrıda başlatılır
"""

from google import genai
from google.genai import types
from app.core.config import settings

MAX_USER_MSG_LEN = 2000
MAX_HISTORY_TURNS = 20

SYSTEM_PROMPT_TEMPLATE = """Sen Stress Less uygulamasının kişisel sağlık asistanısın.
Kullanıcının sağlık profiline ve güncel PPG sensörü ölçüm sonuçlarına erişimin var.
Her zaman Türkçe kullan. Samimi, anlaşılır ve destekleyici ol.
Tıbbi tavsiye değil, bilgilendirici destek sağla. Ciddi durumlarda doktora yönlendir.

=== KULLANICI SAĞLIK PROFİLİ ===
{health_context}
=== SON PPG ÖLÇÜM SONUÇLARI ===
{ppg_context}
================================

## Yanıt Verirken İzlemen Gereken Mantık

Kullanıcı stres ile ilgili bir şey söylediğinde (örneğin "stres seviyem yüksek çıktı", "stresli hissediyorum") şu sırayla kişiselleştirilmiş destek ver:

1. **İlaç kontrolü**: Kullanıcının profilinde ilaç varsa, o ilacı aldı mı diye sor.
   Örnek: "Profilinizde [ilaç adı] görünüyor — bugün aldınız mı?"
   İlaç yoksa bu adımı atla.

2. **Beslenme**: Düzenli yemek yiyip yemediğini sor.
   Örnek: "Bu gün düzenli yemek yediniz mi? Açlık da stres tepkisini artırabilir."

3. **Anlık sakinleşme önerisi**: Kısa ve uygulanabilir bir teknik öner.
   Örnek: "4-7-8 nefes egzersizini deneyin: 4 saniye nefes alın, 7 saniye tutun, 8 saniyede verin."

4. **Olumlu kapanış**: Kısa bir destek cümlesi ekle.

Kullanıcı başka bir konu soruyorsa (HRV, ilaç saati, geçmiş ölçümler vb.) doğrudan konuya gir, yukarıdaki şemayı kullanma.
Cevapları kısa tut — maddeler halinde değil, doğal konuşma dilinde yaz."""

# Lazy init — modül import zamanında değil, ilk kullanımda başlatılır
_client = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        if not settings.GEMINI_API_KEY:
            raise RuntimeError("GEMINI_API_KEY ayarlanmamış. .env dosyasını kontrol edin.")
        _client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _client


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

    # Konuşma geçmişini yeni SDK formatına çevir
    gemini_history = []
    for turn in conversation_history[-MAX_HISTORY_TURNS:]:
        role = "user" if turn.get("role") == "user" else "model"
        gemini_history.append(
            types.Content(
                role=role,
                parts=[types.Part(text=turn.get("content", ""))],
            )
        )

    client = _get_client()
    chat = client.chats.create(
        model=settings.GEMINI_MODEL,
        history=gemini_history,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.7,
            max_output_tokens=1024,
        ),
    )
    response = chat.send_message(message)
    return response.text.strip()
