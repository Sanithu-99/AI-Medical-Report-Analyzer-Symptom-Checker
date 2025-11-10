from __future__ import annotations

import json
import logging
from typing import Any, Dict

import httpx

from ..settings import get_settings


LOGGER = logging.getLogger("healthscore.llm")


class LLMClient:
    """
    Thin abstraction over local Ollama or Vertex AI style endpoints.
    Ensures PHI is never transmitted by expecting pre-anonymised prompts.
    """

    def __init__(self) -> None:
        settings = get_settings()
        self.provider = settings.llm_provider.lower()
        self.ollama_url = settings.ollama_url.rstrip("/")
        self.vertex_model = settings.vertex_model

    async def reason(self, prompt: str) -> Dict[str, Any]:
        if not prompt.strip():
            return {}
        try:
            if self.provider == "ollama":
                return await self._ollama_completion(prompt)
            if self.provider == "vertex":
                return await self._vertex_stub(prompt)
        except Exception as exc:  # pragma: no cover - network
            LOGGER.warning("LLM reasoning failed: %s", exc)
        return {"summary": "Unable to reach LLM provider; falling back to heuristics."}

    async def _ollama_completion(self, prompt: str) -> Dict[str, Any]:
        payload = {"model": "granite:3b", "prompt": prompt, "stream": False}
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.post(f"{self.ollama_url}/api/generate", json=payload)
            response.raise_for_status()
            data = response.json()
            return {"summary": data.get("response", "").strip()}

    async def _vertex_stub(self, prompt: str) -> Dict[str, Any]:
        # Placeholder to integrate with Vertex AI (MedLM) while ensuring prompts remain anonymised.
        return {"summary": f"vertex://{self.vertex_model or 'granite-med'}::{prompt[:120]}..."}


llm_client = LLMClient()
