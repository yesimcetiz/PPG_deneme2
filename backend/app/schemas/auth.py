from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


# ---------- Auth ----------

class RegisterRequest(BaseModel):
    email: EmailStr
    full_name: str
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---------- User ----------

class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Health Profile ----------

class HealthProfileUpdate(BaseModel):
    birth_year: Optional[int] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    gender: Optional[str] = None
    diagnoses: Optional[str] = None       # JSON string
    medications: Optional[str] = None    # JSON string
    allergies: Optional[str] = None
    stress_source: Optional[str] = None
    avg_stress_level: Optional[int] = None


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


# ---------- PPG Result ----------

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