from __future__ import annotations

import math
import re
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Sequence, Tuple

from ..ml.predictor import Predictor


# Each condition entry uses weighted symptom dictionaries so we can promote core findings
# while still acknowledging supportive context and risk factors.
CONDITION_LIBRARY: List[Dict[str, Any]] = [
    {
        "name": "Acute Coronary Syndrome",
        "aliases": ["heart attack", "myocardial infarction", "unstable angina", "acs"],
        "urgency": "emergency",
        "primary_symptoms": {
            "chest pain": 3.5,
            "chest pressure": 3.2,
            "tightness in chest": 3.0,
            "shortness of breath": 2.6,
            "pain radiating to left arm": 3.0,
            "pain radiating to jaw": 2.6,
        },
        "secondary_symptoms": {
            "nausea": 1.2,
            "sweating": 1.8,
            "lightheadedness": 1.4,
            "fatigue": 1.0,
            "upper back pain": 1.5,
        },
        "risk_factors": [
            "hypertension",
            "high blood pressure",
            "smoker",
            "smoking",
            "diabetes",
            "hyperlipidemia",
            "high cholesterol",
            "family history",
        ],
        "red_flags": [
            "crushing chest pain",
            "sudden shortness of breath",
            "fainting",
            "syncope",
            "clammy skin",
        ],
        "recommended_actions": [
            "Call emergency services immediately",
            "Chew an aspirin if not allergic",
            "Avoid physical exertion and rest",
        ],
        "recommended_tests": ["12-lead ECG", "Cardiac troponin", "Emergency cardiology consult"],
        "notes": "Cardiac chest pain often presents with pressure or tightness radiating to the arm or jaw, especially with dyspnea or diaphoresis.",
    },
    {
        "name": "Pulmonary Embolism",
        "aliases": ["pe", "clot in lung", "lung embolism"],
        "urgency": "emergency",
        "primary_symptoms": {
            "sudden shortness of breath": 3.4,
            "pleuritic chest pain": 3.2,
            "rapid heart rate": 2.4,
            "coughing up blood": 3.5,
        },
        "secondary_symptoms": {
            "leg swelling": 2.2,
            "leg pain": 1.8,
            "anxiety": 0.8,
            "dizziness": 1.0,
        },
        "risk_factors": [
            "long flight",
            "recent surgery",
            "immobility",
            "pregnancy",
            "birth control",
            "cancer",
        ],
        "red_flags": ["coughing up blood", "collapse", "syncope"],
        "recommended_actions": [
            "Seek emergency medical care immediately",
            "Limit movement and avoid walking if dizzy",
        ],
        "recommended_tests": ["CT pulmonary angiography", "D-dimer", "Lower limb ultrasound"],
        "notes": "Pulmonary embolism can present subtly; sudden dyspnea with pleuritic pain or hemoptysis is concerning, especially with risk factors.",
    },
    {
        "name": "Ischemic Stroke / TIA",
        "aliases": ["stroke", "transient ischemic attack", "tia"],
        "urgency": "emergency",
        "primary_symptoms": {
            "facial droop": 3.2,
            "slurred speech": 3.1,
            "speech difficulty": 3.1,
            "weakness in arm": 3.0,
            "weakness in leg": 3.0,
            "sudden vision loss": 3.3,
        },
        "secondary_symptoms": {
            "numbness": 1.6,
            "dizziness": 1.4,
            "severe headache": 1.8,
            "confusion": 1.6,
        },
        "risk_factors": ["hypertension", "atrial fibrillation", "diabetes", "smoking", "high cholesterol"],
        "red_flags": ["sudden speech difficulty", "sudden weakness", "loss of vision"],
        "recommended_actions": ["Activate emergency services immediately", "Note the time symptoms started"],
        "recommended_tests": ["Emergency brain imaging", "Neurology consultation", "Blood glucose"],
        "notes": "Stroke symptoms require immediate intervention to preserve brain tissue. Sudden focal neurological deficits are red flags.",
    },
    {
        "name": "Acute Heart Failure Exacerbation",
        "aliases": ["congestive heart failure", "chf exacerbation"],
        "urgency": "urgent",
        "primary_symptoms": {
            "shortness of breath": 2.8,
            "worsening swelling": 2.4,
            "rapid weight gain": 2.0,
            "orthopnea": 2.6,
        },
        "secondary_symptoms": {
            "paroxysmal nocturnal dyspnea": 2.2,
            "fatigue": 1.1,
            "cough": 0.9,
        },
        "risk_factors": ["known heart failure", "coronary artery disease", "hypertension", "kidney disease"],
        "red_flags": ["pink frothy sputum", "severe shortness of breath at rest"],
        "recommended_actions": ["Contact cardiology or emergency department", "Limit fluid and sodium intake"],
        "recommended_tests": ["BNP", "Chest X-ray", "Echocardiogram"],
        "notes": "Acute decompensated heart failure presents with fluid overload and progressive dyspnea, especially when lying flat.",
    },
    {
        "name": "Community-Acquired Pneumonia",
        "aliases": ["pneumonia", "lung infection"],
        "urgency": "urgent",
        "primary_symptoms": {
            "productive cough": 2.2,
            "fever": 2.4,
            "shortness of breath": 2.0,
            "pleuritic chest pain": 2.1,
        },
        "secondary_symptoms": {
            "chills": 1.4,
            "fatigue": 1.2,
            "loss of appetite": 1.0,
            "night sweats": 1.1,
        },
        "risk_factors": ["recent respiratory infection", "smoking", "asthma", "copd"],
        "red_flags": ["confusion", "oxygen saturation below 92"],
        "recommended_actions": ["Arrange urgent clinical review", "Maintain hydration", "Monitor temperature"],
        "recommended_tests": ["Chest X-ray", "Complete blood count", "Pulse oximetry"],
        "notes": "Pneumonia commonly features fever, productive cough, and pleuritic pain, often after a viral prodrome.",
    },
    {
        "name": "Sepsis",
        "aliases": ["septic", "blood infection"],
        "urgency": "emergency",
        "primary_symptoms": {
            "fever": 2.6,
            "chills": 2.4,
            "rapid heart rate": 2.0,
            "rapid breathing": 2.0,
        },
        "secondary_symptoms": {
            "confusion": 2.2,
            "weakness": 1.6,
            "low blood pressure": 2.4,
        },
        "risk_factors": ["immunocompromised", "recent surgery", "open wound", "catheter"],
        "red_flags": ["altered mental status", "very low blood pressure", "mottled skin"],
        "recommended_actions": ["Seek emergency care immediately", "Do not delay antibiotic therapy"],
        "recommended_tests": ["Blood cultures", "Lactate", "Comprehensive metabolic panel"],
        "notes": "Systemic infection with signs of organ dysfunction requires rapid broad-spectrum antibiotics and supportive care.",
    },
    {
        "name": "Migraine With Aura",
        "aliases": ["migraine", "classic migraine"],
        "urgency": "routine",
        "primary_symptoms": {
            "throbbing headache": 2.4,
            "unilateral headache": 2.2,
            "visual aura": 2.6,
            "sensitivity to light": 2.0,
        },
        "secondary_symptoms": {
            "nausea": 1.4,
            "vomiting": 1.4,
            "sensitivity to sound": 1.6,
        },
        "risk_factors": ["history of migraine", "family history of migraine", "stress", "sleep deprivation"],
        "red_flags": ["worst headache of life", "abrupt onset within seconds"],
        "recommended_actions": ["Rest in a dark, quiet room", "Use prescribed triptan or NSAID"],
        "recommended_tests": ["Neurology follow-up if new or changing"],
        "notes": "Migraines often present with throbbing unilateral pain and sensory sensitivity, sometimes preceded by visual aura.",
    },
    {
        "name": "Generalized Anxiety / Panic Episode",
        "aliases": ["panic attack", "anxiety attack"],
        "urgency": "routine",
        "primary_symptoms": {
            "sudden anxiety": 2.0,
            "sense of impending doom": 2.4,
            "chest tightness": 1.8,
            "palpitations": 2.0,
        },
        "secondary_symptoms": {
            "sweating": 1.2,
            "trembling": 1.0,
            "shortness of breath": 1.4,
            "tingling": 1.0,
        },
        "risk_factors": ["history of anxiety", "recent stress", "sleep deprivation"],
        "red_flags": [],
        "recommended_actions": ["Practice paced breathing exercises", "Engage in grounding techniques", "Seek mental health follow-up"],
        "recommended_tests": ["Cardiac evaluation if first episode or atypical"],
        "notes": "Panic episodes can mimic cardiopulmonary emergencies; concurrent chest pain or dyspnea warrants exclusion of organic causes first.",
    },
    {
        "name": "Iron Deficiency Anemia",
        "aliases": ["anemia", "iron deficiency"],
        "urgency": "routine",
        "primary_symptoms": {
            "fatigue": 2.0,
            "dizziness": 1.8,
            "pale skin": 1.6,
            "shortness of breath on exertion": 2.0,
        },
        "secondary_symptoms": {
            "brittle nails": 1.0,
            "headaches": 1.0,
            "cold hands": 0.8,
        },
        "risk_factors": ["heavy periods", "vegetarian diet", "recent blood loss", "pregnancy"],
        "red_flags": ["passing out", "chest pain with exertion"],
        "recommended_actions": ["Schedule primary care follow-up", "Evaluate dietary iron intake"],
        "recommended_tests": ["Complete blood count", "Ferritin", "Iron studies"],
        "notes": "Iron deficiency typically causes exertional fatigue and pallor; investigate sources of blood loss and nutrition.",
    },
    {
        "name": "Poorly Controlled Diabetes",
        "aliases": ["hyperglycemia", "diabetes mellitus"],
        "urgency": "routine",
        "primary_symptoms": {
            "increased thirst": 2.2,
            "frequent urination": 2.2,
            "blurred vision": 1.8,
        },
        "secondary_symptoms": {
            "unintentional weight loss": 1.6,
            "fatigue": 1.4,
            "slow wound healing": 1.4,
        },
        "risk_factors": ["family history", "obesity", "sedentary"],
        "red_flags": ["vomiting", "abdominal pain", "fruity breath"],
        "recommended_actions": ["Check blood glucose if possible", "Hydrate with water", "Seek endocrinology review"],
        "recommended_tests": ["HbA1c", "Serum glucose", "Ketone testing if symptomatic"],
        "notes": "Persistent polyuria and polydipsia suggest hyperglycemia; check for ketones if abdominal pain or vomiting is present.",
    },
    {
        "name": "Viral Gastroenteritis",
        "aliases": ["stomach flu", "gastroenteritis"],
        "urgency": "routine",
        "primary_symptoms": {
            "watery diarrhea": 2.2,
            "vomiting": 2.0,
            "abdominal cramping": 1.8,
        },
        "secondary_symptoms": {
            "low-grade fever": 1.2,
            "nausea": 1.4,
            "body aches": 1.0,
        },
        "risk_factors": ["sick contacts", "recent travel", "contaminated food"],
        "red_flags": ["bloody stool", "signs of dehydration"],
        "recommended_actions": ["Maintain hydration with oral rehydration solutions", "Advance diet slowly"],
        "recommended_tests": ["Stool studies if persistent >1 week"],
        "notes": "Most viral gastroenteritis resolves with supportive care; watch for dehydration or blood in stool.",
    },
    {
        "name": "Kidney Stone",
        "aliases": ["renal colic", "ureteral stone"],
        "urgency": "urgent",
        "primary_symptoms": {
            "flank pain": 2.6,
            "pain radiating to groin": 2.4,
            "hematuria": 2.4,
        },
        "secondary_symptoms": {
            "nausea": 1.2,
            "restlessness": 1.0,
            "urgency to urinate": 1.2,
        },
        "risk_factors": ["history of kidney stones", "low fluid intake", "family history"],
        "red_flags": ["fever", "inability to pass urine"],
        "recommended_actions": ["Seek urgent medical evaluation", "Strain urine if possible"],
        "recommended_tests": ["Urinalysis", "Renal ultrasound", "Non-contrast CT abdomen"],
        "notes": "Renal colic causes severe flank pain radiating to groin with hematuria; fever suggests complicated obstruction.",
    },
]


def _normalize_label(label: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", label.lower()).strip()


@dataclass
class ConditionAssessment:
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


class SymptomAnalyzer:
    def __init__(self, predictor: Predictor | None = None) -> None:
        self._predictor = predictor or Predictor()
        self._regex_cache: Dict[str, re.Pattern[str]] = {}
        self._severity_keywords = {
            "severe": "severe intensity",
            "crushing": "crushing or pressure-like",
            "worsening": "worsening pattern",
            "persistent": "persistent symptoms",
            "debilitating": "debilitating impact",
            "tearing": "tearing quality",
        }
        self._duration_keywords = {
            "sudden": "acute onset",
            "suddenly": "acute onset",
            "overnight": "overnight change",
            "weeks": "lasting weeks",
            "months": "lasting months",
            "days": "lasting days",
            "hours": "lasting hours",
        }
        self._systemic_keywords = {
            "fever": "fever",
            "chills": "chills",
            "night sweats": "night sweats",
            "weight loss": "unintentional weight loss",
            "loss of appetite": "loss of appetite",
            "fainted": "syncope/fainting",
            "syncope": "syncope/fainting",
        }

    def analyze(self, symptoms_text: str) -> Dict[str, Any]:
        cleaned = symptoms_text.strip()
        lowered = cleaned.lower()
        severity_descriptors = self._find_descriptors(lowered, self._severity_keywords.items())
        duration_descriptors = self._find_descriptors(lowered, self._duration_keywords.items())
        systemic_symptoms = self._find_descriptors(lowered, self._systemic_keywords.items())

        ml_support = self._collect_model_support(cleaned)
        ml_lookup = {_normalize_label(label): probability for label, probability in ml_support}

        condition_matches: List[ConditionAssessment] = []
        observed_symptoms: List[str] = []
        for condition in CONDITION_LIBRARY:
            match = self._score_condition(condition, lowered, ml_lookup, severity_descriptors)
            if match:
                condition_matches.append(match)
                observed_symptoms.extend(match.matched_symptoms)

        condition_matches.sort(key=lambda item: (item.likelihood, item.score), reverse=True)
        top_matches = condition_matches[:5]

        normalized_symptoms = sorted({symptom for symptom in observed_symptoms})
        triage = self._build_triage(top_matches, systemic_symptoms, severity_descriptors)
        recommendations = self._build_general_recommendations(cleaned, top_matches, triage)

        return {
            "normalized_symptoms": normalized_symptoms,
            "severity_descriptors": severity_descriptors,
            "duration_descriptors": duration_descriptors,
            "systemic_symptoms": systemic_symptoms,
            "triage": triage,
            "conditions": [match.__dict__ for match in top_matches],
            "model_support": [
                {"label": label, "probability": probability}
                for label, probability in ml_support
            ],
            "general_recommendations": recommendations,
        }

    def _find_descriptors(self, text: str, entries: Iterable[Tuple[str, str]]) -> List[str]:
        hits = {descriptor for keyword, descriptor in entries if keyword in text}
        return sorted(hits)

    def _collect_model_support(self, symptoms_text: str) -> List[Tuple[str, float]]:
        try:
            predictions = self._predictor.predict_proba_from_symptoms(symptoms_text)
        except Exception:  # pragma: no cover - model artifacts may be absent
            predictions = []
        return predictions[:5]

    def _score_condition(
        self,
        condition: Dict[str, Any],
        text: str,
        ml_lookup: Dict[str, float],
        severity_descriptors: Sequence[str],
    ) -> ConditionAssessment | None:
        matched_primary = self._matched_phrases(condition.get("primary_symptoms", {}), text)
        matched_secondary = self._matched_phrases(condition.get("secondary_symptoms", {}), text)
        matched_risk = self._matched_list(condition.get("risk_factors", []), text)
        matched_red_flags = self._matched_list(condition.get("red_flags", []), text)
        matched_alias = any(self._phrase_present(alias, text) for alias in condition.get("aliases", []))
        exclusion_hits = self._matched_list(condition.get("exclusions", []), text)

        if not (matched_primary or matched_secondary or matched_alias or matched_red_flags):
            return None

        primary_weight = sum(condition.get("primary_symptoms", {}).get(item, 1.0) for item in matched_primary)
        secondary_weight = sum(condition.get("secondary_symptoms", {}).get(item, 0.8) for item in matched_secondary)

        alias_bonus = 2.0 if matched_alias else 0.0
        severity_bonus = 1.2 if severity_descriptors else 0.0
        risk_bonus = min(2.4, 0.8 * len(matched_risk))
        red_flag_bonus = 3.5 * len(matched_red_flags)
        ml_bonus = self._ml_bonus(condition, ml_lookup)
        exclusion_penalty = 2.5 * len(exclusion_hits)

        raw_score = (
            (primary_weight * 1.6)
            + (secondary_weight * 1.1)
            + alias_bonus
            + severity_bonus
            + risk_bonus
            + red_flag_bonus
            + ml_bonus
            - exclusion_penalty
        )

        if raw_score <= 0:
            return None

        likelihood = min(0.98, 1 - math.exp(-max(raw_score, 0.1) / 5.0))
        confidence = self._likelihood_to_confidence(likelihood)

        matched_symptoms = sorted(set(matched_primary + matched_secondary + matched_red_flags))
        missing_primary = [
            phrase for phrase in condition.get("primary_symptoms", {}).keys() if phrase not in matched_primary
        ]

        summary = self._build_summary(
            condition["name"],
            matched_primary,
            matched_secondary,
            matched_red_flags,
            matched_risk,
        )

        return ConditionAssessment(
            name=condition["name"],
            score=round(raw_score, 2),
            likelihood=round(likelihood, 4),
            confidence=confidence,
            urgency=condition.get("urgency", "routine"),
            matched_symptoms=matched_symptoms,
            matched_primary_symptoms=matched_primary,
            missing_primary_symptoms=missing_primary,
            matched_risk_factors=matched_risk,
            red_flags=matched_red_flags,
            recommended_actions=condition.get("recommended_actions", []),
            recommended_tests=condition.get("recommended_tests", []),
            summary=summary,
            notes=condition.get("notes", ""),
        )

    def _matched_phrases(self, phrases: Dict[str, float], text: str) -> List[str]:
        return [phrase for phrase in phrases.keys() if self._phrase_present(phrase, text)]

    def _matched_list(self, phrases: Sequence[str], text: str) -> List[str]:
        return [phrase for phrase in phrases if self._phrase_present(phrase, text)]

    def _phrase_present(self, phrase: str, text: str) -> bool:
        pattern = self._regex_cache.get(phrase)
        if pattern is None:
            escaped = re.escape(phrase)
            escaped = escaped.replace(r"\ ", r"\s+")
            pattern = re.compile(rf"(?<!no\s)(?<!denies\s)(?<!without\s)(?<!not\s)\b{escaped}\b")
            self._regex_cache[phrase] = pattern
        return bool(pattern.search(text))

    def _ml_bonus(self, condition: Dict[str, Any], ml_lookup: Dict[str, float]) -> float:
        names = {_normalize_label(condition["name"]) }
        names.update({_normalize_label(alias) for alias in condition.get("aliases", [])})
        best_probability = 0.0
        for candidate in names:
            best_probability = max(best_probability, ml_lookup.get(candidate, 0.0))
        return best_probability * 6.0

    def _likelihood_to_confidence(self, likelihood: float) -> str:
        if likelihood >= 0.75:
            return "high"
        if likelihood >= 0.45:
            return "moderate"
        if likelihood >= 0.25:
            return "emerging"
        return "low"

    def _build_summary(
        self,
        name: str,
        primary: Sequence[str],
        secondary: Sequence[str],
        red_flags: Sequence[str],
        risks: Sequence[str],
    ) -> str:
        fragments: List[str] = []
        if primary:
            fragments.append(f"Core symptom overlap: {', '.join(primary)}.")
        if secondary:
            fragments.append(f"Supportive context: {', '.join(secondary)}.")
        if risks:
            fragments.append(f"Relevant risk factors: {', '.join(risks)}.")
        if red_flags:
            fragments.append(f"Red flags noted: {', '.join(red_flags)}.")
        if not fragments:
            fragments.append("Symptom profile partially aligns; further assessment advised.")
        fragments.append(f"Consider {name} in differential.")
        return " ".join(fragments)

    def _build_triage(
        self,
        matches: Sequence[ConditionAssessment],
        systemic_symptoms: Sequence[str],
        severity_descriptors: Sequence[str],
    ) -> Dict[str, Any]:
        if not matches:
            return {
                "level": "insight",
                "summary": "No strong condition matches detected. Provide more detail or monitor symptoms.",
                "recommended_actions": [
                    "Monitor symptoms and reach out to a clinician if they persist or worsen",
                    "Add duration, severity, and key context for a sharper analysis",
                ],
                "red_flags": [],
            }

        urgency_order = {"emergency": 3, "urgent": 2, "routine": 1, "insight": 0}
        top_match = max(matches, key=lambda item: urgency_order.get(item.urgency, 0))
        level = top_match.urgency
        red_flags = sorted({flag for match in matches for flag in match.red_flags})

        if level == "emergency":
            summary = (
                f"Emergency pattern detected driven by {top_match.name}. Immediate medical evaluation is recommended."
            )
            actions = top_match.recommended_actions or ["Call emergency services", "Do not drive yourself"]
        elif level == "urgent":
            summary = (
                f"Symptoms align with conditions needing urgent evaluation, prominently {top_match.name}."
            )
            actions = top_match.recommended_actions or ["Arrange same-day clinical assessment", "Avoid strenuous activity"]
        else:
            summary = (
                f"Presentation is most consistent with routine follow-up conditions such as {top_match.name}."
            )
            actions = top_match.recommended_actions or ["Schedule primary care review", "Maintain a symptom diary"]

        if systemic_symptoms:
            summary += f" Systemic findings noted: {', '.join(systemic_symptoms)}."
        if severity_descriptors:
            summary += f" Severity cues: {', '.join(severity_descriptors)}."

        return {
            "level": level,
            "summary": summary,
            "recommended_actions": actions,
            "red_flags": red_flags,
        }

    def _build_general_recommendations(
        self,
        original_text: str,
        matches: Sequence[ConditionAssessment],
        triage: Dict[str, Any],
    ) -> List[str]:
        recommendations: List[str] = []
        if not matches:
            recommendations.append("Add timing, triggers, and current medications to sharpen the assessment.")
        else:
            if triage.get("level") == "emergency":
                recommendations.append("Activate emergency services—red flag criteria met.")
            elif triage.get("level") == "urgent":
                recommendations.append("Arrange urgent in-person evaluation to confirm the leading diagnoses.")
            else:
                recommendations.append("Plan follow-up with primary care to review persistent symptoms.")

            if any("medication" in match.notes.lower() for match in matches):
                recommendations.append("Bring a current medication list to appointments.")

        if "fever" in original_text.lower():
            recommendations.append("Track temperature every 4-6 hours until symptoms resolve.")
        if "shortness of breath" in original_text.lower():
            recommendations.append("Seek care immediately if breathing worsens or resting shortness of breath appears.")

        return recommendations
