# 06 — Multilingual (i18n + Bhashini)

## 11 languages

`en, hi, bn, gu, kn, ml, mr, or, pa, ta, te` (English, Hindi, Bengali, Gujarati, Kannada, Malayalam, Marathi, Odia, Punjabi, Tamil, Telugu).

## How a string resolves (frontend)

`t(key, options?)` in `frontend/src/context/LanguageContext.tsx`:

```
uiText[key] ?? (typeof options === 'string' ? options : key)
```

- `uiText` = `{ ...FALLBACK_STRINGS[lang], ...fetchedBackendUiText }`.
- `FALLBACK_STRINGS` is built from an inline `FALLBACK_STRINGS_RAW` map merged with flattened `i18n/locales/en.json` and `hi.json` (only those two JSON locale files exist; the other 9 languages fall back to `en` when offline).
- **A key missing everywhere, with no inline string fallback, renders the raw key literally** — this is the bug class the sync below fixed.
- `{{var}}` interpolation is supported (e.g. `deleteModalDesc` uses `{{localId}}`).
- **`en.json` is the i18n source of truth.**

## Backend UI text

`GET /api/v1/multilingual/ui-text/{lang}` serves `backend-py/static/ui_strings_{lang}.json` — flat dotted keys, one file per language. The frontend fetches this (3.5s timeout) and merges it over the fallback; on failure it uses `FALLBACK_STRINGS[lang]` (or `en`) and flags `translationFailed`.

## Bhashini (Government of India ULCA/Dhruva)

Two-step, in `backend-py/app/services/bhashini.py`:
1. `_get_config(task, src, tgt)` → ULCA auth URL returns a `serviceId` + inference API key (cached per `(task, src, tgt)`, TTL 3600s).
2. Post to the Dhruva inference URL. `inputData.input` is an **array**, so translation is batchable (many `{"source": ...}` per call).

Functions: `translate_text`, `transliterate_text`, `text_to_speech`, `speech_to_text`. Retry/backoff via `bhashini_max_retries`; on failure returns a 503-style fallback (raw key survives).

Bhashini also powers citizen-facing **TTS/ASR** (voice intake in "Get Assistance") and can localize dynamic backend text.

## The 600-key sync (2026-09-27, commit `9c0d644`)

**Problem:** 600 `t()` keys used in code were absent from the backend `ui_strings_*.json`, so those strings rendered as raw keys in the UI.

**Fix pipeline** (scripts kept for re-running):
1. `frontend/scripts/audit_backend_coverage.mjs` — diffs code `t()` keys against `static/ui_strings_en.json`; wrote `_seed_code_missing*.json`. Found 600 missing (551 with a value, 49 without).
2. `frontend/scripts/build_en_seed.mjs` — assembled the complete English seed: 551 from fallback data + 46 from inline JSX fallbacks + 3 authored → `_seed_complete_en.json` (600 keys).
3. `backend-py/scripts/translate_ui_strings.py` — idempotent, resumable batch translator. Adds the 600 English keys verbatim to `ui_strings_en.json`, then for each of the 10 other languages translates only the **missing** keys via Bhashini (`CHUNK = 25`), checkpointing after every chunk.

Result: **all 600 keys present in all 11 languages**, verified.

### Regenerate / extend

```bash
cd backend-py
# smoke test one language, few keys
python scripts/translate_ui_strings.py --langs ta --limit 5
# full run (all 10 non-en languages; idempotent — only fills missing keys)
python scripts/translate_ui_strings.py
```
Set `PYTHONIOENCODING=utf-8` on Windows before printing non-ASCII to the console.

### Known caveats (honest)

- Machine translation may not preserve `{{localId}}`-style placeholders in every language — spot-check interpolated keys.
- ~111 fallback keys never referenced by code were deliberately **not** synced (YAGNI).
- One key equals its English source per non-en language: `auth.otpCodePlaceholder = "000000"` — a numeric placeholder, correctly identical, not a failure.

**Never print or log Bhashini credential values** — reference by length/name only.
