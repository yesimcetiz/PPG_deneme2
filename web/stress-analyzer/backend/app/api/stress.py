from fastapi import APIRouter
from pydantic import BaseModel
from app.services.ml_service import predict_stress

router = APIRouter()

class StressInput(BaseModel):
    MeanNN: float
    SDNN: float
    RMSSD: float
    motion_std: float
    MeanNN_base: float
    SDNN_base: float
    RMSSD_base: float
    motion_base: float

@router.post("/predict")
def predict(data: StressInput):
    result = predict_stress(data.dict())
    return result