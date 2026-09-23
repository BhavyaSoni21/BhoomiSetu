"""Google Earth Engine (`ee`) wrapper - real Sentinel-2 imagery for Change
Detection's satellite-sourced analysis path (app/routers/change_detection.py's
`/analyze-satellite`), as an alternative to an officer's own manually
uploaded before/after photos (`/analyze`, unaffected by any of this).

The detection pipeline itself (app/services/change_detection_service.py's
pixel-diff + spatial intersection + governance alert) needs no changes to
consume this - it already just takes two arbitrary image byte blobs, and
get_ndvi_visual_png returns a plain PNG in that same shape. Earth Engine's
job here is narrow: hand over real satellite bytes, not add new detection
logic.

Same "unset config -> 503 at call time, not at boot" degrade-gracefully
pattern as groq_service.py/gemini_service.py - Earth Engine isn't required
for the rest of Change Detection to keep working.
"""

import threading
from datetime import date, timedelta

import ee
import httpx
from fastapi import HTTPException, status

from app.config import get_settings
from app.services.image_diff import GeoBounds

_initialized = False
_init_lock = threading.Lock()


def gee_credentials() -> "ee.ServiceAccountCredentials | None":
    """Earth Engine service-account credentials, or None if unconfigured.

    Accepts the key as either a raw JSON string (GEE_SERVICE_ACCOUNT_KEY_JSON,
    for hosts like Render/Vercel where secrets are env vars, not files) or a
    file path (GEE_SERVICE_ACCOUNT_KEY_PATH, for local dev). JSON wins if both
    are set.
    """
    settings = get_settings()
    if not settings.gee_service_account_email:
        return None
    if settings.gee_service_account_key_json:
        return ee.ServiceAccountCredentials(settings.gee_service_account_email, key_data=settings.gee_service_account_key_json)
    if settings.gee_service_account_key_path:
        return ee.ServiceAccountCredentials(settings.gee_service_account_email, settings.gee_service_account_key_path)
    return None


def _ensure_initialized() -> None:
    global _initialized
    if _initialized:
        return
    with _init_lock:
        if _initialized:
            return
        credentials = gee_credentials()
        if credentials is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Earth Engine is not configured (set GEE_SERVICE_ACCOUNT_EMAIL and GEE_SERVICE_ACCOUNT_KEY_JSON or _KEY_PATH)",
            )
        try:
            ee.Initialize(credentials)
        except ee.EEException as exc:
            # Credentials present but e.g. the GCP project isn't registered
            # for Earth Engine access - same degrade-gracefully 503 as the
            # not-configured-at-all case above, not a raw 500.
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Earth Engine is configured but not usable: {exc}",
            ) from exc
        _initialized = True


def _least_cloudy_composite(bounds: GeoBounds, for_date: date, cloud_pct_max: int, window_days: int):
    """Shared by both visualizations below: the least-cloudy Sentinel-2
    pixel composite covering the `window_days` before `for_date` over
    `bounds`. A single cloud-free scene on an exact date is unreliable
    (Sentinel-2's revisit is ~5 days, and clouds are common) - compositing
    the least-cloudy pixels across a window is the standard Earth Engine
    pattern for this, at the cost of the result being "the area's recent
    condition near this date", not literally one satellite pass.
    """
    _ensure_initialized()

    region = ee.Geometry.Rectangle([bounds.min_lng, bounds.min_lat, bounds.max_lng, bounds.max_lat])
    start = (for_date - timedelta(days=window_days)).isoformat()
    end = for_date.isoformat()

    collection = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(region)
        .filterDate(start, end)
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", cloud_pct_max))
    )
    if collection.size().getInfo() == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No sufficiently cloud-free Sentinel-2 imagery found for this area in the {window_days} days before {end}",
        )
    return collection.median(), region


def _fetch_thumb_png(visual, region) -> bytes:
    url = visual.getThumbURL({"region": region, "dimensions": 512, "format": "png"})
    response = httpx.get(url, timeout=30.0)
    response.raise_for_status()
    return response.content


def get_ndvi_visual_png(bounds: GeoBounds, for_date: date, cloud_pct_max: int = 20, window_days: int = 30) -> bytes:
    """NDVI false-color PNG (red=bare/stressed, green=healthy vegetation) -
    a plain image, so change_detection_service.analyze() can treat it
    exactly like a manually uploaded photo.
    """
    image, region = _least_cloudy_composite(bounds, for_date, cloud_pct_max, window_days)
    ndvi = image.normalizedDifference(["B8", "B4"])  # NIR, RED
    visual = ndvi.visualize(min=-0.2, max=0.8, palette=["red", "yellow", "green"])
    return _fetch_thumb_png(visual, region)


def get_true_color_visual_png(bounds: GeoBounds, for_date: date, cloud_pct_max: int = 20, window_days: int = 30) -> bytes:
    """A real true-color (RGB) satellite photo PNG - what the area actually
    looked like on a map, as opposed to NDVI's false-color vegetation
    signal. Used by Parcel 360's officer-facing "real satellite image for
    this date" view, not the change-detection diff pipeline.
    """
    image, region = _least_cloudy_composite(bounds, for_date, cloud_pct_max, window_days)
    visual = image.visualize(bands=["B4", "B3", "B2"], min=0, max=3000)
    return _fetch_thumb_png(visual, region)
