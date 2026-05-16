from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Float, Boolean,
    DateTime, ForeignKey, Text, Enum as SAEnum
)
from sqlalchemy.orm import relationship
import enum

from app.core.database import Base


class UserRole(str, enum.Enum):
    user = "user"
    admin = "admin"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(SAEnum(UserRole), default=UserRole.user, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Refresh token (hash olarak saklanır, düz token asla DB'de tutulmaz)
    refresh_token_hash     = Column(String, nullable=True, index=True)
    refresh_token_expires_at = Column(DateTime(timezone=True), nullable=True)

    health_profile = relationship("HealthProfile", back_populates="user", uselist=False)
    ppg_results    = relationship("PPGResult",     back_populates="user")
    chat_messages  = relationship("ChatMessage",   back_populates="user")
    audit_logs     = relationship("AuditLog",      back_populates="user")
    baseline       = relationship("UserBaseline",  back_populates="user", uselist=False)


class HealthProfile(Base):
    __tablename__ = "health_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)

    birth_year       = Column(Integer, nullable=True)
    height_cm        = Column(Float,   nullable=True)
    weight_kg        = Column(Float,   nullable=True)
    gender           = Column(String,  nullable=True)
    diagnoses        = Column(Text,    nullable=True)
    medications      = Column(Text,    nullable=True)
    allergies        = Column(Text,    nullable=True)
    stress_source    = Column(String,  nullable=True)
    avg_stress_level = Column(Integer, nullable=True)
    updated_at       = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="health_profile")


class PPGResult(Base):
    __tablename__ = "ppg_results"

    id             = Column(Integer, primary_key=True, index=True)
    user_id        = Column(Integer, ForeignKey("users.id"), nullable=False)
    p_stress       = Column(Float,   nullable=False)
    y_pred_raw     = Column(Integer, nullable=False)
    y_pred_smooth  = Column(Integer, nullable=False)
    feature_set_used = Column(String, nullable=True)
    mean_hr        = Column(Float,   nullable=True)
    sdnn           = Column(Float,   nullable=True)
    rmssd          = Column(Float,   nullable=True)
    mean_nn        = Column(Float,   nullable=True)
    session_phase  = Column(String,  nullable=True)
    notes          = Column(Text,    nullable=True)
    created_at     = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="ppg_results")


class UserBaseline(Base):
    """Kullanıcının kişisel dinlenme baseline istatistikleri.
    Her kullanıcı için tek satır (unique user_id).
    Her ölçüm oturumunda blend edilerek güncellenir.
    """
    __tablename__ = "user_baselines"

    id      = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)

    # ── Ortalamalar ──────────────────────────────────────────
    mean_nn_mean     = Column(Float, nullable=True)   # ms
    sdnn_mean        = Column(Float, nullable=True)   # ms
    rmssd_mean       = Column(Float, nullable=True)   # ms
    mean_hr_mean     = Column(Float, nullable=True)   # bpm
    motion_std_mean  = Column(Float, nullable=True)   # g

    # ── Standart Sapmalar ────────────────────────────────────
    mean_nn_std      = Column(Float, nullable=True)
    sdnn_std         = Column(Float, nullable=True)
    rmssd_std        = Column(Float, nullable=True)
    mean_hr_std      = Column(Float, nullable=True)
    motion_std_std   = Column(Float, nullable=True)

    # ── Meta ─────────────────────────────────────────────────
    n_sessions  = Column(Integer, default=0, nullable=False)
    updated_at  = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                         onupdate=lambda: datetime.now(timezone.utc))
    created_at  = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="baseline")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    role       = Column(String,  nullable=False)   # "user" | "assistant"
    content    = Column(Text,    nullable=False)
    model_used = Column(String,  nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="chat_messages")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=True)
    action      = Column(String,  nullable=False)   # "login", "register", "ppg_analyze" vb.
    resource    = Column(String,  nullable=True)
    resource_id = Column(String,  nullable=True)
    ip_address  = Column(String,  nullable=True)
    created_at  = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="audit_logs")
