"""
UI Text Helper
==============
Provides get_ui_text(key, lang) for templates and routes to retrieve
pre-translated static UI strings without calling Bhashini live.

Files are loaded lazily on first access per language and cached in memory.
Falls back to English if the language file or key is missing.
"""

import json
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# ── Paths ─────────────────────────────────────────────────────────────────────
_STATIC_DIR = Path(__file__).resolve().parent.parent.parent / "static"

# ── In-memory cache: lang_code -> {key: translated_text} ─────────────────────
_cache: dict[str, dict[str, str]] = {}


def _load(lang: str) -> dict[str, str]:
    """Load and cache a language file. Returns {} if file is missing."""
    if lang in _cache:
        return _cache[lang]

    path = _STATIC_DIR / f"ui_strings_{lang}.json"
    if not path.exists():
        logger.warning(f"ui_text: language file not found: {path}")
        _cache[lang] = {}
        return _cache[lang]

    try:
        with open(path, "r", encoding="utf-8") as f:
            _cache[lang] = json.load(f)
        logger.debug(f"ui_text: loaded {len(_cache[lang])} strings for '{lang}'")
    except Exception as e:
        logger.error(f"ui_text: failed to load {path}: {e}")
        _cache[lang] = {}

    return _cache[lang]


def get_ui_text(key: str, lang: str = "en") -> str:
    """
    Return the translated UI string for `key` in `lang`.

    Falls back to English if:
      - The language file doesn't exist
      - The key is missing in the language file
    Logs a warning (never raises) in fallback cases.

    Args:
        key:  Dot-separated key matching ui_strings_en.json, e.g. "nav.signIn"
        lang: BCP-47 / ISO 639-1 language code, e.g. "hi", "bn", "en"

    Returns:
        The translated string, or the English string, or the key itself as
        last resort if the English file is also missing.
    """
    # Fast path: English — just load the source file
    if lang == "en":
        en_strings = _load("en")
        if key in en_strings:
            return en_strings[key]
        logger.warning(f"ui_text: key '{key}' not found in English strings")
        return key

    # Load the target language
    lang_strings = _load(lang)
    if key in lang_strings:
        return lang_strings[key]

    # Fallback to English
    logger.warning(f"ui_text: key '{key}' not found for lang='{lang}', falling back to English")
    en_strings = _load("en")
    if key in en_strings:
        return en_strings[key]

    # Last resort
    logger.warning(f"ui_text: key '{key}' not found in English either — returning key")
    return key


def preload_languages(langs: Optional[list[str]] = None) -> None:
    """
    Eagerly load language files into memory (e.g. at app startup).
    If `langs` is None, loads English plus all files found in the static dir.
    """
    if langs is not None:
        for lang in langs:
            _load(lang)
        return

    for path in sorted(_STATIC_DIR.glob("ui_strings_*.json")):
        lang = path.stem.replace("ui_strings_", "")
        _load(lang)


def invalidate_cache(lang: Optional[str] = None) -> None:
    """
    Clear the in-memory cache, forcing files to be re-read on next access.
    Pass a specific lang code to clear only that language, or None for all.
    """
    if lang is not None:
        _cache.pop(lang, None)
    else:
        _cache.clear()

