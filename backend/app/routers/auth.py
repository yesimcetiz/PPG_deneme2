from fastapi import APIRouter, Depends, Request, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.database import get_db
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_refresh_token,
)
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse, UserResponse

limiter = Limiter(key_func=get_remote_address)
from app.services.auth_service import register_user, authenticate_user, get_current_user
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


# ─── Yardımcı: her iki token'ı birden üret ───────────────────

def _issue_tokens(user: User, db: Session) -> TokenResponse:
    """
    Access token + Refresh token üretir ve DB'ye kaydeder.
    Login ve refresh endpoint'lerinin her ikisi de bunu kullanır.
    DRY prensibi: kod tekrarı yok.
    """
    # Access token — JWT, 60 dk
    access_token = create_access_token({"sub": str(user.id), "role": user.role.value})

    # Refresh token — opak string, 7 gün
    raw_refresh, refresh_hash, expires_at = generate_refresh_token()

    # Sadece hash'i DB'ye kaydet (güvenlik)
    user.refresh_token_hash       = refresh_hash
    user.refresh_token_expires_at = expires_at
    db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=raw_refresh,  # Ham token kullanıcıya gönderilir
    )


# ─── Endpoint'ler ─────────────────────────────────────────────

@router.post("/register", response_model=UserResponse, status_code=201)
@limiter.limit("5/minute")
def register(data: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    """Yeni kullanıcı kaydı. Admin email listesindeyse role=admin atanır."""
    ip = request.client.host if request.client else None
    return register_user(db, data, ip=ip)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def login(data: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """
    Email/şifre ile giriş.
    Başarılıysa: access_token (60 dk) + refresh_token (7 gün) döner.
    """
    ip = request.client.host if request.client else None
    user = authenticate_user(db, data.email, data.password, ip=ip)
    return _issue_tokens(user, db)


class RefreshRequest(BaseModel):
    refresh_token: str


@router.post("/refresh", response_model=TokenResponse)
def refresh(data: RefreshRequest, db: Session = Depends(get_db)):
    """
    Refresh token ile yeni access token al.

    Akış:
    1. Gelen token'ı hash'le
    2. DB'de bu hash'e sahip kullanıcıyı bul
    3. Süre dolmamış mı kontrol et
    4. Yeni token çifti üret (eski refresh token geçersiz olur)

    Neden eski refresh token geçersiz olur?
    Her refresh'te yeni bir token üretip DB'ye yazıyoruz.
    Eski token'ın hash'i artık DB'de yok → kullanılamaz.
    Bu "token rotation" güvenlik pratiği bir token çalınırsa hasarı sınırlar.
    """
    token_hash = hash_refresh_token(data.refresh_token)

    user = db.query(User).filter(User.refresh_token_hash == token_hash).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz refresh token."
        )

    if not user.refresh_token_expires_at:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token bulunamadı."
        )

    expires_at = user.refresh_token_expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at < datetime.now(timezone.utc):
        # Süresi dolmuş — DB'yi temizle
        user.refresh_token_hash       = None
        user.refresh_token_expires_at = None
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token süresi dolmuş. Lütfen tekrar giriş yapın."
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hesap devre dışı."
        )

    # Token rotation: yeni çift üret, eskisi DB'den silinir
    return _issue_tokens(user, db)


@router.post("/logout")
def logout(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Çıkış yap — refresh token'ı DB'den sil.
    Böylece eski refresh token artık çalışmaz.
    Access token süresi dolana kadar teknik olarak geçerli ama
    60 dakika olduğu için kabul edilebilir risk.
    """
    current_user.refresh_token_hash       = None
    current_user.refresh_token_expires_at = None
    db.commit()
    return {"message": "Başarıyla çıkış yapıldı."}


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    """Token ile aktif kullanıcı bilgisi."""
    return current_user
