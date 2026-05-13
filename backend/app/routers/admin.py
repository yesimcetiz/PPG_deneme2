from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.user import User, PPGResult, ChatMessage, AuditLog
from app.services.auth_service import require_admin

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users")
def list_users(
    skip: int = 0,
    limit: int = 50,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    users = db.query(User).order_by(User.created_at.desc()).offset(skip).limit(limit).all()
    result = []
    for u in users:
        session_count = db.query(PPGResult).filter(PPGResult.user_id == u.id).count()
        result.append({
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "role": u.role.value,
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat(),
            "ppg_session_count": session_count,
        })
    return result


@router.patch("/users/{user_id}/active")
def toggle_user_active(
    user_id: int,
    body: dict,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanici bulunamadi.")
    user.is_active = body.get("is_active", user.is_active)
    db.commit()
    return {"id": user.id, "is_active": user.is_active}


@router.get("/ppg-outputs")
def list_ppg_outputs(
    skip: int = 0,
    limit: int = 100,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    results = (
        db.query(PPGResult)
        .order_by(PPGResult.created_at.desc())
        .offset(skip).limit(limit).all()
    )
    return [
        {
            "session_id": str(r.id),
            "heart_rate": r.mean_hr or 0,
            "hrv_rmssd": r.rmssd or 0,
            "stress_level": "high" if r.y_pred_smooth == 2 else "moderate" if r.y_pred_smooth == 1 else "relaxed",
            "stress_score": round(r.p_stress * 100),
            "analyzed_at": r.created_at.isoformat(),
        }
        for r in results
    ]


@router.get("/audit-logs")
def list_audit_logs(
    skip: int = 0,
    limit: int = 100,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    logs = (
        db.query(AuditLog)
        .order_by(AuditLog.created_at.desc())
        .offset(skip).limit(limit).all()
    )
    return [
        {
            "id": log.id,
            "user_id": log.user_id,
            "user_email": log.user.email if log.user else None,
            "action": log.action,
            "resource": log.resource or "",
            "resource_id": log.resource_id,
            "ip_address": log.ip_address,
            "created_at": log.created_at.isoformat(),
        }
        for log in logs
    ]


@router.get("/stats")
def system_stats(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return {
        "total_users":         db.query(User).count(),
        "active_users":        db.query(User).filter(User.is_active == True).count(),
        "total_ppg_sessions":  db.query(PPGResult).count(),
        "total_chat_messages": db.query(ChatMessage).count(),
        "high_stress_sessions": db.query(PPGResult).filter(PPGResult.y_pred_smooth == 2).count(),
        "moderate_stress_sessions": db.query(PPGResult).filter(PPGResult.y_pred_smooth == 1).count(),
    }
