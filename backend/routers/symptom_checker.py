from fastapi import APIRouter, Depends
from pydantic import BaseModel

from ..ml.predictor import Predictor
from ..routers.auth import get_current_user
from ..models.user_model import User


router = APIRouter()
predictor = Predictor()


class SymptomRequest(BaseModel):
    symptoms: str


@router.post("/")
async def check_symptoms(payload: SymptomRequest, current_user: User = Depends(get_current_user)):
    symptoms = payload.symptoms
    if not symptoms.strip():
        return {"possible_conditions": [], "message": "Please provide symptoms."}

    predictions = predictor.predict_from_symptoms(symptoms)
    return {"possible_conditions": predictions}
