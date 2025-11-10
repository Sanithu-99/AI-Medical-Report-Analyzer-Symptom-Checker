from __future__ import annotations

from collections import OrderedDict
from dataclasses import dataclass
from datetime import datetime
from typing import List, Sequence

from ..ml.predictor import Predictor
from ..models.report_model import MedicalReport


DEFAULT_DISCLAIMER = (
    "AI-generated insights are informational only and are not a substitute for evaluation by a licensed clinician."
)


@dataclass(frozen=True)
class DiagnosisCandidate:
    condition: str
    confidence: float
    confidence_label: str


class DiagnosisEngine:
    def __init__(self, predictor: Predictor, confidence_threshold: float = 0.96) -> None:
        self._predictor = predictor
        self._confidence_threshold = confidence_threshold

    @property
    def confidence_threshold(self) -> float:
        return self._confidence_threshold

    def generate(self, reports: Sequence[MedicalReport]) -> dict:
        report_count = len(reports)
        combined_fragments: List[str] = []
        evidence_map: "OrderedDict[str, str]" = OrderedDict()

        for report in reports:
            summary = (report.ai_summary or "").strip()
            if summary:
                combined_fragments.append(summary)
                evidence_key = f"{report.report_name}: {summary}"
                evidence_map.setdefault(evidence_key, evidence_key)

            for insight in getattr(report, "insights", []) or []:
                cleaned = (insight or "").strip()
                if not cleaned:
                    continue
                combined_fragments.append(cleaned)
                evidence_key = f"{report.report_name}: {cleaned}"
                evidence_map.setdefault(evidence_key, evidence_key)

        if not combined_fragments:
            return self._empty_payload(report_count)

        aggregate_text = " ".join(combined_fragments)
        probabilities = self._predictor.predict_proba_from_symptoms(aggregate_text)
        candidates = [
            DiagnosisCandidate(condition=label, confidence=float(probability), confidence_label=self._confidence_label(probability))
            for label, probability in probabilities[:5]
        ]

        if candidates:
            primary = candidates[0]
            summary = self._build_primary_summary(primary, report_count)
            caution = (
                None
                if primary.confidence >= self._confidence_threshold
                else "Confidence falls below the recommended threshold. Consult a doctor before relying on this signal."
            )
            primary_condition = primary.condition
            primary_confidence = primary.confidence
            primary_label = primary.confidence_label
            meets_threshold = primary.confidence >= self._confidence_threshold
        else:
            fallback_notes = self._predictor.artifacts.fallback(aggregate_text)
            summary = fallback_notes[0] if fallback_notes else "The AI model could not identify a consistent diagnosis from the available reports."
            caution = "The model could not determine a confident diagnosis. Please review findings with a qualified physician."
            primary_condition = None
            primary_confidence = None
            primary_label = None
            meets_threshold = False

        payload = {
            "has_data": True,
            "generated_at": datetime.utcnow().isoformat(),
            "report_count": report_count,
            "primary_condition": primary_condition,
            "primary_confidence": primary_confidence,
            "primary_confidence_label": primary_label,
            "confidence_met_threshold": meets_threshold,
            "confidence_threshold": self._confidence_threshold,
            "summary": summary,
            "supporting_evidence": list(evidence_map.keys())[:5],
            "differentials": [candidate.__dict__ for candidate in candidates],
            "caution": caution,
            "disclaimer": DEFAULT_DISCLAIMER,
        }
        return payload

    def _empty_payload(self, report_count: int) -> dict:
        return {
            "has_data": False,
            "generated_at": datetime.utcnow().isoformat(),
            "report_count": report_count,
            "primary_condition": None,
            "primary_confidence": None,
            "primary_confidence_label": None,
            "confidence_met_threshold": False,
            "confidence_threshold": self._confidence_threshold,
            "summary": "Upload analysed reports to generate an AI-supported differential diagnosis.",
            "supporting_evidence": [],
            "differentials": [],
            "caution": "Provide additional reports and always speak with a healthcare professional for diagnostic decisions.",
            "disclaimer": DEFAULT_DISCLAIMER,
        }

    def _confidence_label(self, value: float) -> str:
        if value >= 0.97:
            return "Very high"
        if value >= 0.9:
            return "High"
        if value >= 0.8:
            return "Moderate"
        if value >= 0.6:
            return "Low"
        return "Very low"

    def _build_primary_summary(self, primary: DiagnosisCandidate, report_count: int) -> str:
        plural = "report" if report_count == 1 else "reports"
        confidence_percent = primary.confidence * 100
        return (
            f"Signals extracted from {report_count} {plural} most strongly align with {primary.condition}. "
            f"Estimated confidence: {confidence_percent:.1f}%."
        )
