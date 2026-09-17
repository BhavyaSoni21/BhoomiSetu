import io

import numpy as np
import pytest
from PIL import Image

from app.document_verification.authenticity import check_authenticity
from app.document_verification.ocr import extract_text


def _png_bytes(array: np.ndarray) -> bytes:
    buffer = io.BytesIO()
    Image.fromarray(array).save(buffer, format="PNG")
    return buffer.getvalue()


def test_a_flat_blank_image_is_flagged_suspicious():
    blank = np.full((300, 300), 200, dtype=np.uint8)
    result = check_authenticity(_png_bytes(blank))
    assert result.suspicious
    assert "LOW_SHARPNESS" in result.reasons
    assert "LOW_EDGE_DENSITY" in result.reasons


def test_a_sharp_textured_image_is_not_flagged():
    rng = np.random.default_rng(42)
    checkerboard = (rng.integers(0, 2, size=(300, 300)) * 255).astype(np.uint8)
    result = check_authenticity(_png_bytes(checkerboard))
    assert not result.suspicious
    assert result.reasons == []


def test_extract_text_returns_empty_result_when_tesseract_is_missing(monkeypatch):
    import pytesseract

    def _raise_missing(*args, **kwargs):
        raise pytesseract.TesseractNotFoundError()

    monkeypatch.setattr(pytesseract, "image_to_data", _raise_missing)
    monkeypatch.setattr(pytesseract, "image_to_string", _raise_missing)

    image = Image.new("RGB", (100, 100), color=(255, 255, 255))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")

    result = extract_text(buffer.getvalue())
    assert result.text == ""
    assert result.confidence == 0.0


if __name__ == "__main__":
    test_a_flat_blank_image_is_flagged_suspicious()
    test_a_sharp_textured_image_is_not_flagged()
    print("ok")
