from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User, HealthProfile
from app.schemas.auth import HealthProfileUpdate, HealthProfileResponse
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("/health", response_model=HealthProfileResponse)
def get_health_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Kullanıcının sağlık profilini döner."""
    profile = db.query(HealthProfile).filter(HealthProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profil bulunamadı.")
    return profile


@router.put("/health", response_model=HealthProfileResponse)
def update_health_profile(
    data: HealthProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Sağlık profilini günceller (PATCH mantığı — sadece gönderilen alanlar)."""
    profile = db.query(HealthProfile).filter(HealthProfile.user_id == current_user.id).first()
    if not profile:
        profile = HealthProfile(user_id=current_user.id)
        db.add(profile)

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)

    db.commit()
    db.refresh(profile)
    return profile