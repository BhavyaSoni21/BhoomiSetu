"""Ported from backend/src/ai/groq.service.ts.

Tech.md #28: "Groq should be integrated only through the backend". Groq's
API is OpenAI-compatible, so this wraps the `openai` package pointed at
Groq's base URL. GROQ_API_KEY is read from settings only.

A module-level function (not a class), matching this codebase's existing
convention for external-AI calls (see app/services/narrative_service.py)
so tests can `monkeypatch.setattr(groq_service, "complete_json", ...)`
directly rather than mocking the `openai` SDK - simpler than the original
TS spec's `jest.mock('openai')`, and the same substitution already used
for HistoricalImageryModule.
"""

import json
import logging
from typing import Any

import openai
from fastapi import HTTPException, status

from app.config import get_settings
from app.services import gemini_service

logger = logging.getLogger(__name__)


def _client() -> openai.OpenAI | None:
    settings = get_settings()
    if not settings.groq_api_key:
        return None
    return openai.OpenAI(api_key=settings.groq_api_key, base_url="https://api.groq.com/openai/v1")


def complete_json(system_prompt: str, user_prompt: str) -> Any:
    """Tech.md #30's "STRUCTURED JSON" step - asks the model for a JSON
    object and parses it. Validation of the *shape* the caller actually
    needs happens one level up (app/services/ai_service.py), not here -
    this function only guarantees valid JSON came back, not that it
    matches any schema.

    Fallback order:
      1. Groq (primary) - skipped if GROQ_API_KEY is unset.
      2. Gemini (fallback) - used when Groq returns 429 or is otherwise
         unavailable. Skipped if GEMINI_API_KEY is also unset.
    """
    client = _client()
    if client is not None:
        try:
            return _complete_via_groq(client, system_prompt, user_prompt)
        except openai.RateLimitError:
            logger.warning("Groq rate/quota limit hit - falling back to Gemini")
        except HTTPException as error:
            logger.warning("Groq unavailable (%s) - falling back to Gemini", error.detail)
        except Exception as error:  # network, bad model name, etc. - still try Gemini before failing
            logger.warning("Groq error - falling back to Gemini. Cause: %s", error)

    if gemini_service.is_configured():
        return gemini_service.complete_json(system_prompt, user_prompt)

    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="AI service is not available (GROQ_API_KEY is not set or quota exceeded, and GEMINI_API_KEY fallback is not configured)",
    )


def _complete_via_groq(client: openai.OpenAI, system_prompt: str, user_prompt: str) -> Any:
    completion = client.chat.completions.create(
        model=get_settings().groq_model,
        messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
        response_format={"type": "json_object"},
        temperature=0.2,
    )
    content = completion.choices[0].message.content if completion.choices else None
    if not content:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Groq returned an empty response")
    try:
        return json.loads(content)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Groq returned malformed JSON") from error
