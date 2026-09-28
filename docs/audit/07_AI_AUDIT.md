# 07 — AI Audit

**Date:** 2026-09-28. Chain: Groq (role-separated messages) → Gemini (concatenated) fallback; deterministic routing fallback if both fail. Grounded in structured parcel-360 data (no true RAG / vector store).

## REL-01 — Undefined `logger` in AI error path (High)
- **Feature/Route:** AI chat · `POST /ai/chat` (ai_service.py:419).
- **Observed:** the error branch references `logger`, which is not imported/defined in the module → a `NameError` fires **inside the error handler**, converting a recoverable AI failure (e.g. provider timeout) into an unhandled 500.
- **Expected:** provider failure is logged and the deterministic fallback returns a graceful response.
- **Root cause:** missing module-level `logger = logging.getLogger(__name__)` (or an unimported symbol).
- **Fix:** define the module logger; verify the fallback path returns cleanly when both providers error.
- **Regression test:** force both Groq and Gemini to raise → assert deterministic fallback response, no NameError, error logged.
- **Status:** OPEN — **fix before demo** (a single provider hiccup during a live demo otherwise 500s the assistant).

## Verified already-OK
- Groq → Gemini fallback chain is wired; deterministic routing fallback exists.
- Responses are grounded in structured parcel-360 context (no hallucinated free-form RAG).
- Two-column assistant layout fix (commit 45fe0b3) present.

## Recommendations (non-blocking)
- Add a lightweight per-request timeout on the provider calls so the fallback triggers fast during a demo rather than hanging.
- Consider logging which provider served each response (Groq/Gemini/deterministic) for demo debugging.
