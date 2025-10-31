from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import List

import spacy
from spacy.language import Language
from spacy.tokens import Doc

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover - optional dependency
    OpenAI = None


logger = logging.getLogger(__name__)


@dataclass
class NLPResult:
    summary: str
    key_terms: List[str]
    entities: List[str]


class Interpreter:
    def __init__(self) -> None:
        self._nlp = self._load_model()
        self._openai_client = self._load_openai_client()

    def _load_model(self) -> Language:
        try:
            nlp = spacy.load("en_core_web_sm")
        except OSError:
            nlp = spacy.blank("en")
            if "sentencizer" not in nlp.pipe_names:
                nlp.add_pipe("sentencizer")
        return nlp

    def _load_openai_client(self):
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key or OpenAI is None:
            return None
        try:
            return OpenAI(api_key=api_key)
        except Exception as exc:  # pragma: no cover - depends on env
            logger.warning("OpenAI client initialization failed: %s", exc)
            return None

    def analyze(self, text: str) -> NLPResult:
        doc = self._nlp(text)
        summary = self._summarize(text, doc)
        key_terms = self._extract_key_terms(doc)
        entities = [ent.text for ent in doc.ents]
        return NLPResult(summary=summary, key_terms=key_terms, entities=entities)

    def _summarize(self, original_text: str, doc: Doc) -> str:
        if self._openai_client:
            try:
                response = self._openai_client.responses.create(
                    model="gpt-4o-mini",
                    input=f"Summarize this medical report in <=120 words and highlight key findings:\n\n{original_text}",
                    max_output_tokens=180,
                )
                summary = getattr(response, "output_text", "").strip()
                if summary:
                    return summary
            except Exception as exc:  # pragma: no cover - external API
                logger.warning("OpenAI summary failed, falling back to spaCy: %s", exc)

        sentences = list(doc.sents)
        if not sentences:
            return doc.text[:250]
        top_sentences = sentences[:3]
        summary = " ".join(sent.text.strip() for sent in top_sentences)
        return summary or doc.text[:250]

    def _extract_key_terms(self, doc: Doc) -> List[str]:
        lemmas = [token.lemma_.lower() for token in doc if token.is_alpha and not token.is_stop]
        unique_lemmas = sorted(set(lemmas))[:10]
        return unique_lemmas


interpreter = Interpreter()


def interpret_text(text: str) -> NLPResult:
    return interpreter.analyze(text)
