from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, List, Tuple

import spacy
from spacy.language import Language

from ..database import get_collection
from ..security.encryption import get_encryption_manager


PHI_LABELS = {
    "PERSON",
    "GPE",
    "LOC",
    "ORG",
    "DATE",
    "TIME",
    "NORP",
    "FAC",
    "LANGUAGE",
}

PHI_PATTERNS = {
    "phone": re.compile(r"(?:\+?\d{1,2}\s*)?(?:\(\d{3}\)|\d{3})[-.\s]?\d{3}[-.\s]?\d{4}"),
    "mrn": re.compile(r"\bMRN[:\s\-]*\d{6,}\b", re.IGNORECASE),
    "ssn": re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
    "email": re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}"),
    "zipcode": re.compile(r"\b\d{5}(?:-\d{4})?\b"),
}


@dataclass
class AnonymizationResult:
    sanitized_text: str
    mapping_id: str | None
    tokens: List[str]
    quasi_identifiers: Dict[str, str]


class AnonymizationService:
    """Redacts PHI before persisting data, keeping a hashed lookup in a separate encrypted collection."""

    def __init__(self) -> None:
        try:
            self._nlp: Language = spacy.load("en_core_web_sm")
        except OSError:  # pragma: no cover - spaCy model may be missing in CI
            self._nlp = spacy.blank("en")
        self.encryption = get_encryption_manager()

    async def anonymize(self, text: str, metadata: Dict[str, str] | None, user_id: str) -> AnonymizationResult:
        if not text:
            return AnonymizationResult(sanitized_text="", mapping_id=None, tokens=[], quasi_identifiers={})

        doc = self._nlp(text)
        replacements: List[Tuple[int, int, str, str]] = []
        for ent in doc.ents:
            if ent.label_ in PHI_LABELS:
                token = self.encryption.create_hmac_token(ent.text)
                replacements.append((ent.start_char, ent.end_char, token, ent.label_))

        for label, pattern in PHI_PATTERNS.items():
            for match in pattern.finditer(text):
                token = self.encryption.create_hmac_token(match.group())
                replacements.append((match.start(), match.end(), token, label.upper()))

        replacements.sort(key=lambda item: item[0])
        sanitized = []
        pointer = 0
        tokens: List[str] = []
        for start, end, token, label in replacements:
            sanitized.append(text[pointer:start])
            sanitized.append(f"<{label}:{token[:10]}>")
            pointer = end
            tokens.append(token)
        sanitized.append(text[pointer:])
        quasi = self._generalize_quasi_identifiers(metadata or {})
        mapping_id = await self._persist_mapping(user_id, tokens, metadata, replacements, quasi)
        return AnonymizationResult(
            sanitized_text="".join(sanitized),
            mapping_id=mapping_id,
            tokens=tokens,
            quasi_identifiers=quasi,
        )

    async def _persist_mapping(
        self,
        user_id: str,
        tokens: List[str],
        metadata: Dict[str, str] | None,
        spans: List[Tuple[int, int, str, str]],
        quasi_identifiers: Dict[str, str],
    ) -> str | None:
        if not tokens:
            return None

        payload = {
            "user_id": user_id,
            "tokens": tokens,
            "spans": spans,
            "original_metadata": metadata or {},
            "quasi_identifiers": quasi_identifiers,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        encrypted = self.encryption.encrypt(payload)
        collection = get_collection("phi_mapping")
        result = await collection.insert_one(
            {
                "user_id": user_id,
                "payload": encrypted,
                "created_at": payload["created_at"],
            }
        )
        return str(result.inserted_id)

    def _generalize_quasi_identifiers(self, metadata: Dict[str, str]) -> Dict[str, str]:
        generalized: Dict[str, str] = {}
        dob = metadata.get("dob") or metadata.get("date_of_birth")
        if dob:
            bucket = self._dob_to_age_bucket(dob)
            if bucket:
                generalized["age_bucket"] = bucket

        zipcode = metadata.get("zip") or metadata.get("zipcode")
        if zipcode:
            generalized["region"] = f"{zipcode[:3]}XX"

        gender = metadata.get("gender")
        if gender:
            generalized["gender"] = gender[0].upper()
        return generalized

    @staticmethod
    def _dob_to_age_bucket(value: str) -> str | None:
        try:
            dt = datetime.fromisoformat(value)
        except ValueError:
            return None
        today = datetime.now(timezone.utc)
        years = today.year - dt.year - ((today.month, today.day) < (dt.month, dt.day))
        if years < 18:
            return "0-17"
        if years < 30:
            return "18-29"
        if years < 45:
            return "30-44"
        if years < 60:
            return "45-59"
        if years < 75:
            return "60-74"
        return "75+"


anonymization_service = AnonymizationService()
