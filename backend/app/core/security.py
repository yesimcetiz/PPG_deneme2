import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

REFRESH_TOKEN_EXPIRE_DAYS = 7


# ─── Şifre işlemleri ─────────────────────────────────────────

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ─── Access Token (JWT, kısa ömürlü) ─────────────────────────

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    60 dakika geçerli JWT access token oluşturur.
    Payload: {"sub": "1", "role": "admin", "type": "access", "exp": ...}
    """
    to_encode = data.copy()
    to_encode["type"] = "access"
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode["exp"] = expire
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None


# ─── Refresh Token (opak, uzun ömürlü) ───────────────────────

def generate_refresh_token() -> tuple[str, str, datetime]:
    """
    Güvenli rastgele refresh token üretir.

    Neden JWT değil?
    Refresh token JWT olsaydı logout'ta geçersiz kılamazdık — JWT sunucu
    tarafında durum tutmaz. Bunun yerine:
    - Düz token (kullanıcıya gönderilir): güvenli rastgele string
    - Hash (DB'ye kaydedilir): SHA-256 hash, çalınsa bile işe yaramaz

    Returns:
        raw_token:  Kullanıcıya verilecek string (AsyncStorage'a kaydedilir)
        token_hash: DB'ye kaydedilecek hash
        expires_at: Son kullanma tarihi
    """
    raw_token  = secrets.token_urlsafe(48)          # 64 karakter URL-safe string
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    return raw_token, token_hash, expires_at


def hash_refresh_token(raw_token: str) -> str:
    """Gelen token'ı hash'le (DB ile karşılaştırmak için)."""
    return hashlib.sha256(raw_token.encode()).hexdigest()
