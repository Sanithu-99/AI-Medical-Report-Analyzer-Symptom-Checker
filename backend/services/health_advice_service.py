from __future__ import annotations

from collections import OrderedDict
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Sequence

from ..models.report_model import MedicalReport


DEFAULT_ADVICE_DISCLAIMER = (
    "These wellness pointers are informational and should complement, not replace, guidance from your healthcare team."
)


@dataclass(frozen=True)
class AdviceTemplate:
    id: str
    title: str
    description: str
    keywords: List[str]
    actions: List[str]


ADVICE_LIBRARY: List[AdviceTemplate] = [
    AdviceTemplate(
        id="cardio_support",
        title="Support cardiovascular health",
        description="Signals of elevated blood pressure or lipid trends suggest prioritising heart-friendly habits.",
        keywords=[
            "blood pressure",
            "hypertension",
            "ldl",
            "cholesterol",
            "lipid",
            "angina",
            "arrhythm",
            "cardio",
            "cardiac",
            "tachycardia",
        ],
        actions=[
            "Adopt the DASH or Mediterranean-style eating pattern with abundant vegetables and lean proteins.",
            "Keep daily sodium below 1500 mg and spread hydration across the day.",
            "Aim for 150 minutes weekly of moderate aerobic activity plus 2 strength sessions if cleared by your clinician.",
        ],
    ),
    AdviceTemplate(
        id="glucose_balance",
        title="Stabilise glucose and metabolic control",
        description="Report patterns hint at metabolic stress that benefits from consistent nutrition and movement.",
        keywords=[
            "glucose",
            "hba1c",
            "hyperglycemia",
            "insulin",
            "metabolic",
            "weight gain",
            "obesity",
            "diabetes",
        ],
        actions=[
            "Build balanced plates: half non-starchy vegetables, quarter lean protein, quarter complex carbohydrates.",
            "Use post-meal walks (10–15 minutes) to improve insulin sensitivity.",
            "Prioritise 7–8 hours of high-quality sleep to support endocrine balance.",
        ],
    ),
    AdviceTemplate(
        id="respiratory_support",
        title="Optimise respiratory resilience",
        description="Respiratory findings benefit from lung-friendly habits and mindful breathing.",
        keywords=[
            "shortness of breath",
            "dyspnea",
            "asthma",
            "copd",
            "pulmonary",
            "oxygen",
            "respiratory",
            "wheezing",
            "bronch",
        ],
        actions=[
            "Incorporate diaphragmatic breathing or pursed-lip exercises for 5 minutes twice daily.",
            "Avoid environmental triggers: smoke exposure, poorly ventilated indoor spaces, and known allergens.",
            "Gradually build low-impact cardio (walking, cycling, swimming) under medical clearance to expand lung capacity.",
        ],
    ),
    AdviceTemplate(
        id="stress_recovery",
        title="Prioritise recovery and stress balance",
        description="Fatigue-related mentions indicate nervous system strain that improves with structured recovery.",
        keywords=[
            "fatigue",
            "burnout",
            "sleep",
            "insomnia",
            "stress",
            "anxiety",
            "depression",
            "tired",
            "exhaustion",
        ],
        actions=[
            "Anchor a consistent sleep schedule: same bedtime and wake time within 60 minutes daily.",
            "Use a 5-minute evening wind-down (box breathing, journaling, or light stretching) to signal rest.",
            "Layer short restorative breaks (micro-walks, daylight exposure) across the workday.",
        ],
    ),
    AdviceTemplate(
        id="inflammation_balance",
        title="Lower inflammatory burden",
        description="Inflammatory or immune markers respond to anti-inflammatory nutrition and gentle movement.",
        keywords=[
            "inflammation",
            "crp",
            "autoimmune",
            "flare",
            "infection",
            "sepsis",
            "arthritis",
            "erythrocyte",
        ],
        actions=[
            "Boost omega-3 intake (fatty fish twice weekly or flax/chia seeds daily).",
            "Center meals around colourful produce to supply antioxidants and polyphenols.",
            "Introduce low-impact mobility work (yoga, tai chi) to maintain joint function without overloading.",
        ],
    ),
]

GENERAL_FOUNDATIONS = [
    {
        "title": "Daily movement baseline",
        "description": "Movement variety keeps joints supple and metabolism responsive.",
        "actions": [
            "Accumulate at least 7000 steps per day or 150 minutes of moderate activity weekly.",
            "Include two sessions of resistance training targeting major muscle groups.",
        ],
        "matched_keywords": [],
    },
    {
        "title": "Nutrition essentials",
        "description": "Consistent, nutrient-dense meals stabilise energy and support recovery.",
        "actions": [
            "Build meals with lean protein, fibre-rich carbohydrates, and healthy fats to stay satiated.",
            "Limit ultra-processed foods and added sugars; favour whole-food snacks.",
        ],
        "matched_keywords": [],
    },
    {
        "title": "Habit stacking for success",
        "description": "Linking habits makes healthy choices easier to maintain.",
        "actions": [
            "Pair new health behaviours with existing routines (e.g., stretch after brushing teeth).",
            "Track hydration, movement, and sleep in a simple log to stay accountable.",
        ],
        "matched_keywords": [],
    },
]


@dataclass(frozen=True)
class AdviceResult:
    title: str
    description: str
    actions: List[str]
    matched_keywords: List[str]


class HealthAdviceEngine:
    def __init__(self, keyword_weight: float = 1.0) -> None:
        self._keyword_weight = keyword_weight

    def generate(self, reports: Sequence[MedicalReport]) -> Dict:
        report_count = len(reports)
        if report_count == 0:
            return self._empty_payload()

        evidence_texts: List[str] = []
        evidence_map: "OrderedDict[str, str]" = OrderedDict()

        for report in reports:
            summary = (report.ai_summary or "").strip()
            if summary:
                evidence_texts.append(summary)
                key = f"{report.report_name}: {summary}"
                evidence_map.setdefault(key, key)

            for insight in getattr(report, "insights", []) or []:
                cleaned = (insight or "").strip()
                if not cleaned:
                    continue
                evidence_texts.append(cleaned)
                key = f"{report.report_name}: {cleaned}"
                evidence_map.setdefault(key, key)

        if not evidence_texts:
            payload = self._empty_payload()
            payload["report_count"] = report_count
            return payload

        aggregate_text = " ".join(evidence_texts).lower()
        suggestions: List[AdviceResult] = []

        for template in ADVICE_LIBRARY:
            matched_keywords = [keyword for keyword in template.keywords if keyword in aggregate_text]
            score = len(matched_keywords) * self._keyword_weight
            if score > 0:
                suggestions.append(
                    AdviceResult(
                        title=template.title,
                        description=template.description,
                        actions=template.actions,
                        matched_keywords=matched_keywords[:6],
                    )
                )

        suggestions.sort(key=lambda item: len(item.matched_keywords), reverse=True)
        top_suggestions = suggestions[:4]

        summary = (
            f"AI reviewed {report_count} report{'s' if report_count != 1 else ''} and prioritised "
            f"{len(top_suggestions) or 'foundational'} habit focus area{'s' if len(top_suggestions) != 1 else ''}."
        )

        if not top_suggestions:
            summary += " No specific biomarkers stood out — reinforce the core habits below."

        advice_payload = [
            {
                "title": suggestion.title,
                "description": suggestion.description,
                "actions": suggestion.actions,
                "matched_keywords": suggestion.matched_keywords,
            }
            for suggestion in top_suggestions
        ]

        advice_payload.extend(GENERAL_FOUNDATIONS[:2])

        return {
            "has_data": True,
            "generated_at": datetime.utcnow().isoformat(),
            "report_count": report_count,
            "summary": summary,
            "advice": advice_payload,
            "supporting_evidence": list(evidence_map.keys())[:5],
            "disclaimer": DEFAULT_ADVICE_DISCLAIMER,
        }

    def _empty_payload(self) -> Dict:
        return {
            "has_data": False,
            "generated_at": datetime.utcnow().isoformat(),
            "report_count": 0,
            "summary": "Upload a medical report to unlock personalised health habit recommendations.",
            "advice": GENERAL_FOUNDATIONS,
            "supporting_evidence": [],
            "disclaimer": DEFAULT_ADVICE_DISCLAIMER,
        }
