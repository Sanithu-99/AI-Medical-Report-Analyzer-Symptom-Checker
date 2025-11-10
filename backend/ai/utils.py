from __future__ import annotations

from statistics import mean
from typing import Iterable, List


def clamp(value: float, min_value: float = 0, max_value: float = 1) -> float:
    return max(min_value, min(max_value, value))


def normalize_metric(value: float, optimal: float, tolerance: float) -> float:
    """
    Returns a score between 0 and 1 where 1 means optimal health.
    """

    if tolerance == 0:
        return 1.0
    delta = abs(value - optimal) / tolerance
    return clamp(1 - delta)


def average_scores(scores: Iterable[float]) -> float:
    values = list(scores)
    if not values:
        return 0.0
    return mean(values)


def bucket_confidence(num_reports: int, supporting_signals: int) -> float:
    base = min(num_reports / 10, 1.0)
    signal_boost = min(supporting_signals / 5, 1.0) * 0.3
    return clamp(base * 0.7 + signal_boost)


def suggestion_from_risk(risk: str) -> str:
    mapping = {
        "cholesterol": "Increase cardio and prioritise soluble fibre intake.",
        "bmi": "Adopt a calorie-aware nutrition plan and schedule weekly activity.",
        "bp": "Monitor blood pressure twice daily and reduce sodium.",
        "glucose": "Stabilise blood sugar with low-glycaemic meals and hydration.",
        "sleep": "Improve sleep hygiene with consistent bedtimes and dark environments.",
    }
    return mapping.get(risk, "Consult with your clinician for a personalised plan.")
