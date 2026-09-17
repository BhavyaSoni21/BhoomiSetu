"""Ported from backend/src/ai/gemini.service.ts.

Gemini AI fallback, used by groq_service when Groq hits a rate limit
(HTTP 429) or is unavailable. Same complete_json(...) contract as
groq_service so callers (app/services/ai_service.py) need no changes.
"""

import json
import re

import google.generativeai as genai
from fastapi import HTTPException, status

from app.config import get_settings

_SAFETY_SETTINGS = {
    # Relaxed just enough for land-governance data - the default
    # BLOCK_MEDIUM_AND_ABOVE blocks legitimate but rare edge cases like
    # dispute descriptions containing violence-adjacent legal language.
    "HARM_CATEGORY_HARASSMENT": "BLOCK_ONLY_HIGH",
    "HARM_CATEGORY_HATE_SPEECH": "BLOCK_ONLY_HIGH",
    "HARM_CATEGORY_SEXUALLY_EXPLICIT": "BLOCK_ONLY_HIGH",
    "HARM_CATEGORY_DANGEROUS_CONTENT": "BLOCK_ONLY_HIGH",
}


def is_configured() -> bool:
    return bool(get_settings().gemini_api_key)


def complete_json(system_prompt: str, user_prompt: str) -> object:
    settings = get_settings()
    if not settings.gemini_api_key:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Gemini fallback is not configured (GEMINI_API_KEY is not set)")

    genai.configure(api_key=settings.gemini_api_key)
    model = genai.GenerativeModel(
        settings.gemini_model,
        safety_settings=_SAFETY_SETTINGS,
        generation_config={"temperature": 0.2, "response_mime_type": "application/json"},
    )
    # Gemini uses a combined system+user prompt pattern for chat completions.
    result = model.generate_content(f"{system_prompt}\n\n---\n\nUser message:\n{user_prompt}")

    text = result.text if result.candidates else None
    if not text:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Gemini returned an empty response")

    # Strip markdown fences if the model wraps the JSON in ```json ... ```
    cleaned = re.sub(r"^```(?:json)?\s*", "", text)
    cleaned = re.sub(r"\s*```\s*$", "", cleaned).strip()

    try:
        return json.loads(cleaned)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Gemini returned malformed JSON") from error
