from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List

from app.core.database import get_db
from app.models.user import User, ChatMessage as ChatMessageModel
from app.services.auth_service import get_current_user
from app.services.chat_service import chat_with_gemini

router = APIRouter(prefix="/chat", tags=["chat"])


class MessageRequest(BaseModel):
    message: str
    conversation_history: List[dict] = []
    health_context: Optional[dict] = None


class MessageResponse(BaseModel):
    reply: str
    model: str = "gemini-2.0-flash"


@router.post("/message", response_model=MessageResponse)
def send_message(
    data: MessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Kullanıcının mesajını Gemini'ye iletir.
    Sağlık profili ve son PPG verileri sistem promptuna eklenir.
    """
    if not data.message.strip():
        raise HTTPException(status_code=400, detail="Mesaj boş olamaz.")

    # Son PPG sonucunu DB'den çek
    from app.models.user import PPGResult
    last_ppg = (
        db.query(PPGResult)
        .filter(PPGResult.user_id == current_user.id)
        .order_by(PPGResult.created_at.desc())
        .first()
    )

    ppg_context = None
    if last_ppg:
        stress_label = "high" if last_ppg.y_pred_smooth == 1 else "relaxed"
        ppg_context = {
            "latest_stress_level": stress_label,
            "latest_heart_rate": round(last_ppg.mean_hr) if last_ppg.mean_hr else None,
            "latest_hrv_rmssd": round(last_ppg.rmssd) if last_ppg.rmssd else None,
        }

    try:
        reply = chat_with_gemini(
            message=data.message,
            conversation_history=data.conversation_history,
            health_context=data.health_context,
            ppg_context=ppg_context,
        )
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"AI servisi şu an kullanılamıyor: {str(e)}")

    # Konuşmayı DB'ye kaydet
    db.add(ChatMessageModel(
        user_id=current_user.id,
        role="user",
        content=data.message[:2000],
        model_used="gemini-2.0-flash",
    ))
    db.add(ChatMessageModel(
        user_id=current_user.id,
        role="assistant",
        content=reply[:4000],
        model_used="gemini-2.0-flash",
    ))
    db.commit()

    return MessageResponse(reply=reply)


@router.get("/history")
def get_chat_history(
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Kullanıcının sohbet geçmişi."""
    messages = (
        db.query(ChatMessageModel)
        .filter(ChatMessageModel.user_id == current_user.id)
        .order_by(ChatMessageModel.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "role": m.role,
            "content": m.content,
            "created_at": m.created_at.isoformat(),
        }
        for m in reversed(messages)
    ]
