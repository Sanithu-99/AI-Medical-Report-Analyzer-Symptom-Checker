from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from ..ml.predictor import Predictor
from ..models.user_model import User
from ..routers.auth import get_current_user
from ..services.symptom_service import SymptomAnalyzer
from ..services.subscription_service import subscription_service


router = APIRouter()
predictor = Predictor()
analyzer = SymptomAnalyzer(predictor)


class SymptomRequest(BaseModel):
    symptoms: str


class ModelSupport(BaseModel):
    label: str
    probability: float


class ConditionAnalysis(BaseModel):
    name: str
    score: float
    likelihood: float
    confidence: str
    urgency: str
    matched_symptoms: List[str]
    matched_primary_symptoms: List[str]
    missing_primary_symptoms: List[str]
    matched_risk_factors: List[str]
    red_flags: List[str]
    recommended_actions: List[str]
    recommended_tests: List[str]
    summary: str
    notes: str


class TriageAdvice(BaseModel):
    level: str
    summary: str
    recommended_actions: List[str]
    red_flags: List[str]


class SymptomAnalysis(BaseModel):
    normalized_symptoms: List[str]
    severity_descriptors: List[str]
    duration_descriptors: List[str]
    systemic_symptoms: List[str]
    triage: TriageAdvice
    conditions: List[ConditionAnalysis]
    model_support: List[ModelSupport]
    general_recommendations: List[str]


class SymptomResponse(BaseModel):
    possible_conditions: List[str]
    analysis: SymptomAnalysis


@router.post("/", response_model=SymptomResponse)
async def check_symptoms(payload: SymptomRequest, current_user: User = Depends(get_current_user)) -> SymptomResponse:
    await subscription_service.assert_symptom_quota(current_user.id, current_user.plan)
    symptoms = payload.symptoms.strip()
    if not symptoms:
        empty_analysis = SymptomAnalysis(
            normalized_symptoms=[],
            severity_descriptors=[],
            duration_descriptors=[],
            systemic_symptoms=[],
            triage=TriageAdvice(
                level="insight",
                summary="Please provide symptoms to begin analysis.",
                recommended_actions=["Describe the main symptoms, timing, and severity."],
                red_flags=[],
            ),
            conditions=[],
            model_support=[],
            general_recommendations=[],
        )
        return SymptomResponse(possible_conditions=[], analysis=empty_analysis)

    analysis_payload = analyzer.analyze(symptoms)
    analysis = SymptomAnalysis(**analysis_payload)

    possible_conditions = [
        f"{condition.name}: {condition.likelihood * 100:.1f}% ({condition.confidence})"
        for condition in analysis.conditions[:3]
    ]
    if not possible_conditions:
        fallback = predictor.artifacts.fallback(symptoms)
        possible_conditions = fallback if isinstance(fallback, list) else [str(fallback)]

    await subscription_service.increment_usage(current_user.id, "symptom_checks")
    return SymptomResponse(possible_conditions=possible_conditions, analysis=analysis)
