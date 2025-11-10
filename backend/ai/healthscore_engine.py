from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from typing import List

from ..models.report_model import MedicalReport
from .llm_integration import llm_client
from .utils import bucket_confidence, clamp, suggestion_from_risk


RISK_WEIGHTS = {
    "cholesterol": 0.22,
    "hdl": 0.1,
    "ldl": 0.18,
    "bmi": 0.15,
    "triglyceride": 0.18,
    "glucose": 0.2,
    "hypertension": 0.25,
    "bp": 0.2,
    "stress": 0.05,
    "sleep": 0.08,
}


@dataclass
class HealthScoreResult:
    overall_health_score: int
    risk_factors: List[str]
    improvement_suggestions: List[str]
    confidence: float
    reasoning: str


class HealthScoreEngine:
    def __init__(self) -> None:
        self.enabled = True

    async def score(self, reports: List[MedicalReport], plan: str) -> dict:
        if not reports:
            return {
                "overall_health_score": 75,
                "risk_factors": [],
                "improvement_suggestions": ["Upload reports to unlock personalised scoring."],
                "confidence": 0.15,
                "reasoning": "No reports available; showing baseline score.",
            }

        risk_counter = Counter()
        for report in reports:
            lowered = report.extracted_text.lower()
            for keyword, weight in RISK_WEIGHTS.items():
                if keyword in lowered:
                    risk_counter[keyword] += weight

        total_penalty = sum(weight for _, weight in risk_counter.most_common())
        base_score = clamp(0.95 - total_penalty, 0.35, 0.98)
        overall_score = int(base_score * 100)
        risk_factors = [factor for factor, _ in risk_counter.most_common(4)]
        suggestions = [suggestion_from_risk(risk) for risk in risk_factors[:3]]
        confidence = bucket_confidence(len(reports), len(risk_factors))

        reasoning = ""
        if plan in {"clinician", "institution"}:
            prompt = self._make_prompt(reports, risk_factors, suggestions)
            response = await llm_client.reason(prompt)
            reasoning = response.get("summary", "")

        return {
            "overall_health_score": overall_score,
            "risk_factors": risk_factors,
            "improvement_suggestions": suggestions,
            "confidence": round(confidence, 2),
            "reasoning": reasoning or "Upgrade plan for AI narrative insights.",
        }

    def _make_prompt(self, reports: List[MedicalReport], risks: List[str], suggestions: List[str]) -> str:
        latest = reports[0]
        return (
            "You are a clinical decision support model. "
            "Given anonymised lab narratives, outline concise reasoning. "
            f"Risks: {', '.join(risks) or 'none'}. "
            f"Suggestions already provided: {', '.join(suggestions) or 'general wellness'}. "
            f"Latest summary: {latest.ai_summary[:500]}"
        )


healthscore_engine = HealthScoreEngine()
