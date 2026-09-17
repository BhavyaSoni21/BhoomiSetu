"""Ported from backend/src/document-verification/ocr.ts.

Thin wrapper around pytesseract (local, in-process OCR via the tesseract
binary - no external API key, no network call per request), tesseract.js's
Python-world equivalent.

If the system Tesseract binary is absent in a developer environment, we
return an empty OCR result instead of crashing the workflow creation path.
"""

import io
from dataclasses import dataclass

import pytesseract
from PIL import Image


@dataclass
class OcrResult:
    text: str
    confidence: float  # 0-100, tesseract's own mean confidence across recognized words


def extract_text(image_bytes: bytes) -> OcrResult:
    try:
        image = Image.open(io.BytesIO(image_bytes))
        data = pytesseract.image_to_data(image, lang="eng", output_type=pytesseract.Output.DICT)
        text = pytesseract.image_to_string(image, lang="eng")

        confidences = [float(c) for c in data.get("conf", []) if str(c).strip() not in ("", "-1")]
        confidence = sum(confidences) / len(confidences) if confidences else 0.0
        return OcrResult(text=text, confidence=confidence)
    except pytesseract.TesseractNotFoundError:
        return OcrResult(text="", confidence=0.0)
