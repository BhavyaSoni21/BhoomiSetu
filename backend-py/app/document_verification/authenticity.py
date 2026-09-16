"""OpenCV-based tamper/authenticity heuristic for uploaded land documents,
alongside (not instead of) ocr.py's field extraction (BACKLOG.md item 15).

A soft signal for the reviewing officer, not a hard accept/reject gate -
the thresholds below are hand-tuned, not validated against a real corpus
of tampered documents. Three cheap, well-known image-forensics heuristics:

- Sharpness (variance of the Laplacian): a genuine document scan/photo is
  reasonably sharp; an unusually blurry image can indicate a rescanned
  photocopy, a screenshot of a screenshot, or a deliberately degraded
  edit meant to hide tampering artifacts.
- Edge density (fraction of Canny edge pixels): unusually low suggests a
  flat/blank or heavily smoothed image; unusually high can indicate
  compression artifacts or added/pasted content with hard edges.
- Noise level (stddev of the high-frequency residual): near-zero noise
  across an entire "photo" is a signal of a purely digital/screenshotted
  image rather than a real camera capture.
"""

import io
from dataclasses import dataclass

import cv2
import numpy as np
from PIL import Image

_SHARPNESS_MIN = 50.0
_EDGE_DENSITY_MIN = 0.01
_EDGE_DENSITY_MAX = 0.35


@dataclass
class AuthenticityResult:
    suspicious: bool
    reasons: list[str]
    sharpness: float
    edge_density: float
    noise_level: float


def check_authenticity(image_bytes: bytes) -> AuthenticityResult:
    image = Image.open(io.BytesIO(image_bytes)).convert("L")
    gray = np.array(image)

    sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())

    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    noise_level = float(np.std(gray.astype(np.float32) - blurred.astype(np.float32)))

    edges = cv2.Canny(gray, 100, 200)
    edge_density = float(np.count_nonzero(edges)) / edges.size

    reasons: list[str] = []
    if sharpness < _SHARPNESS_MIN:
        reasons.append("LOW_SHARPNESS")
    if edge_density < _EDGE_DENSITY_MIN:
        reasons.append("LOW_EDGE_DENSITY")
    elif edge_density > _EDGE_DENSITY_MAX:
        reasons.append("HIGH_EDGE_DENSITY")

    return AuthenticityResult(
        suspicious=bool(reasons), reasons=reasons,
        sharpness=sharpness, edge_density=edge_density, noise_level=noise_level,
    )
