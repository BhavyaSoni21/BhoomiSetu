"""
Batch Translation Script for BhoomiSetu Static UI Strings
==========================================================
Loads static/ui_strings_en.json, translates every string into each of the 10
supported target languages using the existing bhashini.py translate_text() function,
and saves results to static/ui_strings_<lang>.json.

Usage:
    cd backend-py
    python scripts/batch_translate_ui.py

Re-run safely: already-translated keys are skipped (incremental mode).
"""

import asyncio
import json
import logging
import sys
import time
from pathlib import Path

# ── Path setup: allow importing from the backend-py package root ─────────────
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.services.bhashini import translate_text

# ── Config ───────────────────────────────────────────────────────────────────
STATIC_DIR = ROOT / "static"
SOURCE_FILE = STATIC_DIR / "ui_strings_en.json"

TARGET_LANGUAGES = ["hi", "bn", "gu", "kn", "ml", "mr", "or", "pa", "ta", "te"]

# Delay between individual API calls (seconds) — avoids burst quota exhaustion
API_CALL_DELAY = 0.4

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


async def translate_language(
    keys: list[str],
    strings: dict[str, str],
    lang: str,
    output_path: Path,
) -> tuple[int, int, int]:
    """
    Translate all strings for one target language.
    Returns (translated, skipped, failed) counts.
    """
    # Load existing cache from disk (if file already exists)
    cached: dict[str, str] = {}
    if output_path.exists():
        try:
            with open(output_path, "r", encoding="utf-8") as f:
                cached = json.load(f)
        except Exception:
            cached = {}

    translated = 0
    skipped = 0
    failed = 0
    total = len(keys)
    result: dict[str, str] = dict(cached)  # start from cache

    for idx, key in enumerate(keys, start=1):
        en_text = strings[key]

        # Skip if already cached
        if key in cached:
            skipped += 1
            continue

        logger.info(f"  Translating {idx}/{total}: {key!r} -> {lang}")

        try:
            tr = await translate_text(en_text, source_lang="en", target_lang=lang)
            result[key] = tr.translated_text
            translated += 1
        except Exception as e:
            logger.error(f"  FAILED {key!r} -> {lang}: {e}")
            result[key] = en_text  # fall back to English on failure
            failed += 1

        # Persist incrementally after every key so progress is not lost on crash
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)

        # Rate-limit: only sleep between calls, not after the last one
        if idx < total and key not in cached:
            await asyncio.sleep(API_CALL_DELAY)

    return translated, skipped, failed


async def main() -> None:
    if not SOURCE_FILE.exists():
        logger.error(f"Source file not found: {SOURCE_FILE}")
        sys.exit(1)

    with open(SOURCE_FILE, "r", encoding="utf-8") as f:
        strings: dict[str, str] = json.load(f)

    keys = list(strings.keys())
    total_keys = len(keys)
    logger.info(f"Loaded {total_keys} strings from {SOURCE_FILE.name}")
    logger.info(f"Target languages: {TARGET_LANGUAGES}")
    logger.info("=" * 60)

    grand_translated = 0
    grand_skipped = 0
    grand_failed = 0
    wall_start = time.time()

    for lang in TARGET_LANGUAGES:
        output_path = STATIC_DIR / f"ui_strings_{lang}.json"
        logger.info(f"\n[{lang.upper()}] → {output_path.name}")

        t, s, f = await translate_language(keys, strings, lang, output_path)
        grand_translated += t
        grand_skipped += s
        grand_failed += f

        logger.info(
            f"[{lang.upper()}] done — translated: {t}, skipped/cached: {s}, failed: {f}"
        )

    elapsed = time.time() - wall_start
    logger.info("\n" + "=" * 60)
    logger.info("FINAL SUMMARY")
    logger.info("=" * 60)
    logger.info(f"  Languages processed : {len(TARGET_LANGUAGES)}")
    logger.info(f"  Strings per language: {total_keys}")
    logger.info(f"  Total translated    : {grand_translated}")
    logger.info(f"  Total skipped/cached: {grand_skipped}")
    logger.info(f"  Total failed        : {grand_failed}")
    logger.info(f"  Wall time           : {elapsed:.1f}s")

    if grand_failed > 0:
        logger.warning(
            f"{grand_failed} string(s) failed to translate — they fell back to "
            f"the English source text in the output JSON files."
        )
    logger.info("Output files written to: " + str(STATIC_DIR))


if __name__ == "__main__":
    asyncio.run(main())

