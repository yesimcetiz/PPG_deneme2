"""
Debug router — sadece DEV ortamında aktif.
Production'da bu endpoint'ler devre dışı kalır.
"""
from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional

from app.core.database import get_db
from app.core.config import settings
from app.core.security import decode_token
from app.models.user import User, AuditLog

router = APIRouter(prefix="/debug", tags=["debug"])


def _require_dev():
    """Production'da bu router'ı tamamen kapat."""
    import os
    if os.getenv("ENVIRONMENT", "development") == "production":
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Not found")


@router.get("/health-full")
def full_health(db: Session = Depends(get_db)):
    """DB bağlantısı, tablo sayıları, ortam bilgisi."""
    _require_dev()
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception as e:
        db_ok = False

    user_count = db.query(User).count()
    log_count  = db.query(AuditLog).count()

    return {
        "db_connected":   db_ok,
        "user_count":     user_count,
        "audit_log_count": log_count,
        "gemini_key_set": bool(settings.GEMINI_API_KEY),
        "admin_emails":   settings.admin_email_list,
    }


@router.get("/decode-token")
def decode_jwt(authorization: Optional[str] = Header(None)):
    """Token içeriğini decode et — login sorunlarını teşhis için."""
    _require_dev()
    if not authorization or not authorization.startswith("Bearer "):
        return {"error": "Authorization header eksik veya yanlış format"}

    token = authorization.replace("Bearer ", "")
    payload = decode_token(token)

    if not payload:
        return {"error": "Token geçersiz veya süresi dolmuş"}

    return {
        "raw_payload": payload,
        "sub_type":    type(payload.get("sub")).__name__,
        "sub_value":   payload.get("sub"),
        "role":        payload.get("role"),
        "exp":         payload.get("exp"),
    }


@router.get("/users")
def list_users_debug(db: Session = Depends(get_db)):
    """DB'deki tüm kullanıcıları göster (şifresiz)."""
    _require_dev()
    users = db.query(User).all()
    return [
        {
            "id":         u.id,
            "email":      u.email,
            "role":       u.role.value,
            "is_active":  u.is_active,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ]


@router.get("/audit-logs")
def audit_logs_debug(limit: int = 20, db: Session = Depends(get_db)):
    """Son audit logları."""
    _require_dev()
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit).all()
    return [
        {
            "action":     l.action,
            "user_id":    l.user_id,
            "ip":         l.ip_address,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        }
        for l in logs
    ]
