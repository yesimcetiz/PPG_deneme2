from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from datetime import datetime
import re


# ─── Auth ────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    full_name: str
    password: str

    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        """
        Şifre politikası:
        - En az 8 karakter
        - En az 1 büyük harf (A-Z)
        - En az 1 küçük harf (a-z)
        - En az 1 rakam (0-9)

        Neden bu kurallar?
        "abc" gibi basit şifreler brute-force saldırılarına çok açıktır.
        Bu minimum kurallar şifre uzayını dramatik şekilde genişletir.
        """
        errors = []

        if len(v) < 8:
            errors.append('en az 8 karakter')
        if not re.search(r'[A-Z]', v):
            errors.append('en az 1 büyük harf (A-Z)')
        if not re.search(r'[a-z]', v):
            errors.append('en az 1 küçük harf (a-z)')
        if not re.search(r'[0-9]', v):
            errors.append('en az 1 rakam (0-9)')

        if errors:
            raise ValueError(f"Şifre şunları içermeli: {', '.join(errors)}.")

        return v

    @field_validator('full_name')
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError('Ad soyad en az 2 karakter olmalı.')
        if len(v) > 100:
            raise ValueError('Ad soyad en fazla 100 karakter olabilir.')
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str          # Yeni eklendi — 7 günlük
    token_type: str = "bearer"
    expires_in: int = 3600      # Saniye cinsinden (mobil için bilgi)


# ─── User ────────────────────────────────────────────────────

class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Health Profile ──────────────────────────────────────────

class HealthProfileUpdate(BaseModel):
    birth_year: Optional[int] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    gender: Optional[str] = None
    diagnoses: Optional[str] = None
    medications: Optional[str] = None
    allergies: Optional[str] = None
    stress_source: Optional[str] = None
    avg_stress_level: Optional[int] = None

    @field_validator('birth_year')
    @classmethod
    def validate_birth_year(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and not (1900 <= v <= 2015):
            raise ValueError('Geçerli bir doğum yılı girin (1900-2015).')
        return v

    @field_validator('avg_stress_level')
    @classmethod
    def validate_stress_level(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and not (1 <= v <= 10):
            raise ValueError('Stres seviyesi 1 ile 10 arasında olmalı.')
        return v


class HealthProfileResponse(BaseModel):
    id: int
    user_id: int
    birth_year: Optional[int]
    height_cm: Optional[float]
    weight_kg: Optional[float]
    gender: Optional[str]
    diagnoses: Optional[str]
    medications: Optional[str]
    allergies: Optional[str]
    stress_source: Optional[str]
    avg_stress_level: Optional[int]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


# ─── PPG Result ──────────────────────────────────────────────

class PPGResultResponse(BaseModel):
    id: int
    user_id: int
    p_stress: float
    y_pred_raw: int
    y_pred_smooth: int
    feature_set_used: Optional[str]
    mean_hr: Optional[float]
    sdnn: Optional[float]
    rmssd: Optional[float]
    mean_nn: Optional[float]
    session_phase: Optional[str]
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
