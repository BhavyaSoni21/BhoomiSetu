import io

import numpy as np
from PIL import Image

from app.document_verification.authenticity import check_authenticity


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


if __name__ == "__main__":
    test_a_flat_blank_image_is_flagged_suspicious()
    test_a_sharp_textured_image_is_not_flagged()
    print("ok")
