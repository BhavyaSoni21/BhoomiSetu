"""Ported from backend/src/document-verification/field-matcher.ts.

Pure, OCR/DB-independent matching helpers - deliberately tolerant of the
noise real OCR output has (inconsistent spacing around punctuation, mixed
case, stray line breaks) rather than requiring an exact string match.
"""

import re


def _normalize(value: str) -> str:
    return re.sub(r"\s+", "", value.lower())


def text_contains_identifier(ocr_text: str, identifier_value: str) -> bool:
    """Identifiers (survey numbers, ULPINs, plot numbers) are short,
    distinctive alphanumeric codes - a whitespace-insensitive substring
    match is enough, and avoids false negatives from OCR inserting/
    dropping spaces around slashes or hyphens (e.g. "45/7" read as "45 / 7").
    """
    if not identifier_value:
        return False
    return _normalize(identifier_value) in _normalize(ocr_text)


def text_contains_name(ocr_text: str, expected_name: str) -> bool:
    """Names are harder: OCR can misread individual characters, and a real
    document might print "A. Sharma" for "Amit Sharma". Rather than
    demanding an exact match, this counts how many of the expected name's
    words appear (as whole words, case-insensitively) anywhere in the
    text and requires a majority - tolerant of one misread word without
    accepting an unrelated name.
    """
    words = [w for w in expected_name.lower().split() if w]
    if not words:
        return False
    lower_text = ocr_text.lower()
    matched_count = sum(1 for word in words if word in lower_text)
    return matched_count / len(words) >= 0.6


def text_contains_approx_number(ocr_text: str, expected: float, tolerance_pct: float = 0.05) -> bool:
    """Finds any number in the OCR text within a tolerance of the expected
    value - real documents print area with varying decimal precision/
    rounding, and OCR itself can misread a digit, so an exact match would
    be unreasonably strict for a scanned/photographed document.
    """
    numbers = [float(n) for n in re.findall(r"\d+(?:\.\d+)?", ocr_text)]
    return any(abs(n - expected) <= expected * tolerance_pct for n in numbers)
