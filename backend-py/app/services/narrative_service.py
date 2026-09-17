"""Ported from backend/src/historical-imagery/narrative.service.ts.

Same OpenAI-compatible OpenRouter client the old VisionService used
(GroqService's own model doesn't take image input, so this stays
independent of GROQ_API_KEY) - text-only, no images sent (a live latency
test measured ~62-95s WITH the two snapshot images attached vs ~11s
text-only for the identical prompt, for zero new information, since the
LLM's job is only to phrase already-known facts, never to visually detect
anything).
"""

import re
from dataclasses import dataclass

from fastapi import HTTPException, status
from openai import OpenAI

from app.config import get_settings


@dataclass
class ParcelChangeFact:
    canonical_parcel_id: str
    from_category: str
    to_category: str
    # A short, factual, already-true sentence about *why* (the real
    # dispute/restriction record behind the category) - the LLM is asked
    # to phrase this for a reader, not to invent it, so a hallucinated
    # cause can never reach a GovernanceAlert's explanation text.
    facts: str


def _client() -> OpenAI | None:
    settings = get_settings()
    if not settings.openrouter_api_key:
        return None
    return OpenAI(api_key=settings.openrouter_api_key, base_url="https://openrouter.ai/api/v1")


def explain_parcel_changes(from_year: int, to_year: int, parcels: list[ParcelChangeFact]) -> dict[str, str]:
    client = _client()
    if client is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Narrative AI service is not configured (OPENROUTER_API_KEY is not set)")
    if not parcels:
        return {}

    fact_lines = "\n".join(
        f'- {p.canonical_parcel_id}: was "{p.from_category}" in {from_year}, is now "{p.to_category}" in {to_year}. {p.facts}'
        for p in parcels
    )
    prompt = (
        f"The following land parcels have a real, documented change on file between {from_year} and {to_year}:\n{fact_lines}\n\n"
        "For each parcel listed above, write exactly one short, plain-language sentence for a land officer explaining what "
        'the situation is now - state the real fact given, do not invent details beyond it. Reply with exactly one line per '
        'parcel, formatted as "<parcel id>: <sentence>", nothing else before or after.'
    )

    completion = client.chat.completions.create(
        model=get_settings().openrouter_model,
        messages=[{"role": "user", "content": prompt}],
    )
    content = completion.choices[0].message.content if completion.choices else None
    if not content:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Narrative AI service returned an empty response")
    return _parse_narratives(content, parcels)


def _parse_narratives(content: str, parcels: list[ParcelChangeFact]) -> dict[str, str]:
    """Lenient line-based parsing (not strict JSON) - free/small models are
    unreliable at strict JSON formatting, and a per-parcel fallback
    template is only a caller's data lookup away, so a partially-parsed
    response still leaves every parcel with a real explanation either way.
    """
    known_ids = {p.canonical_parcel_id for p in parcels}
    result: dict[str, str] = {}
    for raw_line in content.split("\n"):
        line = re.sub(r"^[-*\d.\s]+", "", raw_line).strip()
        separator_index = line.find(":")
        if separator_index == -1:
            continue
        parcel_id = line[:separator_index].strip()
        sentence = line[separator_index + 1 :].strip()
        if parcel_id in known_ids and sentence:
            result[parcel_id] = sentence
    return result
