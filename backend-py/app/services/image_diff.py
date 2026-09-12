"""Ported from backend/src/change-detection/image-diff.ts.

Pure, dependency-free pixel comparison: given two same-sized raw RGBA
buffers, find the bounding box of pixels that actually changed.
"""

from dataclasses import dataclass

# Per-channel average absolute difference above which a pixel counts as
# "changed" - tolerant of lossy re-encoding noise between two real photos of
# the same scene, sensitive enough to catch an actual new structure.
_CHANGE_THRESHOLD = 30

# Below this fraction of the image, treat it as noise (JPEG artifacts,
# lighting) rather than a real physical change - mirrors OpenCV pipelines
# discarding tiny contours.
_MIN_CHANGED_PIXEL_RATIO = 0.002


@dataclass
class PixelBox:
    min_row: int
    max_row: int
    min_col: int
    max_col: int


@dataclass
class ImageDiffResult:
    changed: bool
    changed_pixel_ratio: float
    bbox: PixelBox | None


def diff_images(before: bytes, after: bytes, width: int, height: int) -> ImageDiffResult:
    channels = 4  # raw RGBA buffers
    min_row, max_row, min_col, max_col = height, -1, width, -1
    changed_count = 0

    for row in range(height):
        for col in range(width):
            idx = (row * width + col) * channels
            diff = (
                abs(before[idx] - after[idx])
                + abs(before[idx + 1] - after[idx + 1])
                + abs(before[idx + 2] - after[idx + 2])
            ) / 3
            if diff > _CHANGE_THRESHOLD:
                changed_count += 1
                min_row = min(min_row, row)
                max_row = max(max_row, row)
                min_col = min(min_col, col)
                max_col = max(max_col, col)

    changed_pixel_ratio = changed_count / (width * height)
    changed = changed_pixel_ratio >= _MIN_CHANGED_PIXEL_RATIO

    return ImageDiffResult(
        changed=changed,
        changed_pixel_ratio=changed_pixel_ratio,
        bbox=PixelBox(min_row, max_row, min_col, max_col) if changed else None,
    )


@dataclass
class GeoBounds:
    min_lng: float
    min_lat: float
    max_lng: float
    max_lat: float


def pixel_box_to_geo_box(bbox: PixelBox, image_width: int, image_height: int, bounds: GeoBounds) -> GeoBounds:
    """The caller states the real geographic footprint the two images
    cover, so the detected pixel box can be mapped back to a real GeoJSON
    rectangle for the spatial-intersection step.
    """
    lng_per_col = (bounds.max_lng - bounds.min_lng) / image_width
    lat_per_row = (bounds.max_lat - bounds.min_lat) / image_height

    return GeoBounds(
        min_lng=bounds.min_lng + bbox.min_col * lng_per_col,
        max_lng=bounds.min_lng + (bbox.max_col + 1) * lng_per_col,
        # Row 0 is the top of the image (= max_lat); increasing row = decreasing lat.
        max_lat=bounds.max_lat - bbox.min_row * lat_per_row,
        min_lat=bounds.max_lat - (bbox.max_row + 1) * lat_per_row,
    )
