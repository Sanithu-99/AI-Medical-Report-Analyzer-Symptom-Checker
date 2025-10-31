from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Callable, List

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer



MODEL_DIR = Path(__file__).resolve().parent
MODEL_PATH = MODEL_DIR / "model.joblib"
VECTORIZER_PATH = MODEL_DIR / "vectorizer.joblib"


@dataclass
class PredictorArtifacts:
    model: RandomForestClassifier
    vectorizer: TfidfVectorizer
    fallback: Callable[[str], List[str]]


class Predictor:
    def __init__(self) -> None:
        self.artifacts = self._load_artifacts()

    def _load_artifacts(self) -> PredictorArtifacts:
        if MODEL_PATH.exists() and VECTORIZER_PATH.exists():
            model = joblib.load(MODEL_PATH)
            vectorizer = joblib.load(VECTORIZER_PATH)
        else:
            model = RandomForestClassifier()
            vectorizer = TfidfVectorizer()
        fallback = self._make_fallback()
        return PredictorArtifacts(model=model, vectorizer=vectorizer, fallback=fallback)

    def predict(self, report_text: str, key_terms: List[str]) -> List[str]:
        combined_input = " ".join([report_text, " ".join(key_terms)])
        if self._is_vectorizer_ready():
            vector = self.artifacts.vectorizer.transform([combined_input])
        else:
            return self.artifacts.fallback(combined_input)

        if hasattr(self.artifacts.model, "predict_proba") and getattr(self.artifacts.model, "classes_", None) is not None:
            probabilities = self.artifacts.model.predict_proba(vector)[0]
            classes = getattr(self.artifacts.model, "classes_", [])
            sorted_indices = np.argsort(probabilities)[::-1]
            insights = [
                f"{classes[idx]}: {probabilities[idx]:.2%}"
                for idx in sorted_indices[:3]
            ]
            return insights
        return self.artifacts.fallback(combined_input)

    def predict_from_symptoms(self, symptoms: str) -> List[str]:
        if self._is_vectorizer_ready():
            vector = self.artifacts.vectorizer.transform([symptoms])
        else:
            return self.artifacts.fallback(symptoms)

        if hasattr(self.artifacts.model, "predict_proba") and getattr(self.artifacts.model, "classes_", None) is not None:
            probabilities = self.artifacts.model.predict_proba(vector)[0]
            classes = getattr(self.artifacts.model, "classes_", [])
            sorted_indices = np.argsort(probabilities)[::-1]
            return [
                f"{classes[idx]}: {probabilities[idx]:.2%}"
                for idx in sorted_indices[:3]
            ]
        return self.artifacts.fallback(symptoms)

    def _is_vectorizer_ready(self) -> bool:
        return hasattr(self.artifacts.vectorizer, "vocabulary_") and self.artifacts.vectorizer.vocabulary_

    def _make_fallback(self) -> Callable[[str], List[str]]:
        keyword_map = {
            "glucose": "Potential elevated blood sugar levels",
            "insulin": "Consider diabetes screening",
            "anemia": "Possible anemia indicators present",
            "hemoglobin": "Check hemoglobin trends",
            "cholesterol": "Lipids may be elevated",
            "pressure": "Monitor blood pressure closely",
            "fatigue": "General fatigue reported",
        }

        def _fallback(text: str) -> List[str]:
            lowered = text.lower()
            matches = [message for keyword, message in keyword_map.items() if keyword in lowered]
            if not matches:
                matches = ["No strong indicators detected — consider consulting a clinician."]
            return matches[:3]

        return _fallback
