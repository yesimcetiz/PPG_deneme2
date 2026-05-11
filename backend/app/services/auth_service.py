from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.security import decode_token, hash_password, verify_password
from app.core.config import settings
from app.models.user import User, UserRole, HealthProfile, AuditLog
from app.schemas.auth import RegisterRequest

bearer_scheme = HTTPBearer()


# ─── Audit log yardımcısı ─────────────────────────────────────

def write_audit(
    db: Session,
    action: str,
    user_id: int | None = None,
    resource: str | None = None,
    resource_id: str | None = None,
    ip_address: str | None = None,
):
    log = AuditLog(
        user_id=user_id,
        action=action,
        resource=resource,
        resource_id=resource_id,
        ip_address=ip_address,
        created_at=datetime.now(timezone.utc),
    )
    db.add(log)
    db.commit()


# ─── Kullanıcı işlemleri ─────────────────────────────────────

def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()


def register_user(db: Session, data: RegisterRequest, ip: str | None = None) -> User:
    if get_user_by_email(db, data.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu email adresi zaten kayıtlı."
        )
    role = UserRole.admin if data.email in settings.admin_email_list else UserRole.user
    user = User(
        email=data.email,
        full_name=data.full_name,
        hashed_password=hash_password(data.password),
        role=role,
        created_at=datetime.now(timezone.utc),
    )
    db.add(user)
    db.flush()
    profile = HealthProfile(user_id=user.id)
    db.add(profile)
    db.commit()
    db.refresh(user)

    write_audit(db, "register", user_id=user.id, resource="user",
                resource_id=str(user.id), ip_address=ip)
    return user


def authenticate_user(db: Session, email: str, password: str, ip: str | None = None) -> User:
    user = get_user_by_email(db, email)
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email veya şifre hatalı."
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hesap devre dışı."
        )
    write_audit(db, "login", user_id=user.id, resource="user",
                resource_id=str(user.id), ip_address=ip)
    return user


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz veya süresi dolmuş token."
        )

    # BUG-002 fix: sub string olarak kaydediliyor, int'e çevir
    try:
        user_id = int(payload.get("sub"))
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz token içeriği."
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Kullanıcı bulunamadı."
        )
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin yetkisi gerekli."
        )
    return current_user
