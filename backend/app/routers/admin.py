from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.user import User, PPGResult
from app.schemas.auth import UserResponse, PPGResultResponse
from app.services.auth_service import require_admin

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=List[UserResponse])
def list_users(
    skip: int = 0,
    limit: int = 50,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Tüm kayıtlı kullanıcılar."""
    return db.query(User).order_by(User.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/results", response_model=List[PPGResultResponse])
def list_all_results(
    skip: int = 0,
    limit: int = 100,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Tüm kullanıcıların PPG sonuçları — model audit için."""
    return (
        db.query(PPGResult)
        .order_by(PPGResult.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get("/stats")
def system_stats(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Özet istatistikler."""
    total_users = db.query(User).count()
    total_results = db.query(PPGResult).count()
    stress_count = db.query(PPGResult).filter(PPGResult.y_pred_smooth == 1).count()
    return {
        "total_users": total_users,
        "total_ppg_results": total_results,
        "stress_predictions": stress_count,
        "non_stress_predictions": total_results - stress_count,
    }