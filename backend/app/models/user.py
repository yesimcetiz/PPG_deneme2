from datetime import datetime
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
    created_at = Column(DateTime, default=datetime.utcnow)
 
    health_profile = relationship("HealthProfile", back_populates="user", uselist=False)
    ppg_results = relationship("PPGResult", back_populates="user")
 
 
class HealthProfile(Base):
    __tablename__ = "health_profiles"
 
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
 
    # Temel bilgiler
    birth_year = Column(Integer, nullable=True)
    height_cm = Column(Float, nullable=True)
    weight_kg = Column(Float, nullable=True)
    gender = Column(String, nullable=True)
 
    # Sağlık durumu
    diagnoses = Column(Text, nullable=True)       # JSON string: ["tip1_diyabet", "hipertansiyon"]
    medications = Column(Text, nullable=True)     # JSON string: [{"name":"metformin","dose":"500mg","times":["sabah"]}]
    allergies = Column(Text, nullable=True)
 
    # Stres geçmişi
    stress_source = Column(String, nullable=True) # "is", "okul", "aile", "diger"
    avg_stress_level = Column(Integer, nullable=True)  # 1-10 skala
 
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
 
    user = relationship("User", back_populates="health_profile")
 
 
class PPGResult(Base):
    __tablename__ = "ppg_results"
 
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
 
    # Model çıktısı
    p_stress = Column(Float, nullable=False)
    y_pred_raw = Column(Integer, nullable=False)
    y_pred_smooth = Column(Integer, nullable=False)
    feature_set_used = Column(String, nullable=True)
 
    # HRV özellikleri (audit için sakla)
    mean_hr = Column(Float, nullable=True)
    sdnn = Column(Float, nullable=True)
    rmssd = Column(Float, nullable=True)
    mean_nn = Column(Float, nullable=True)
 
    # Bağlam
    session_phase = Column(String, nullable=True)  # "Base", "Live", "Test"
    notes = Column(Text, nullable=True)
 
    created_at = Column(DateTime, default=datetime.utcnow)
 
    user = relationship("User", back_populates="ppg_results")
