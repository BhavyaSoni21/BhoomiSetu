"""Real road orientation lookup via the OSM Overpass API.

Replaces the configured `dominant_angle_deg`/`secondary_angle_deg` stand-in
on a ClusterGeometryConfig with the actual dominant road bearing near that
cluster's center, so generated parcel envelopes/splits line up with real
streets instead of an arbitrary angle. Falls back to the configured angle
whenever the network call fails or no roads are found nearby - per the
seed-pipeline requirement that missing external data must never crash
seeding (see docs/context_aware_parcel_generation_upgrade.md section 26).

Results are cached to disk (keyed by rounded lat/lng) since seeding is run
repeatedly during development and Overpass is a shared public service.
"""

import json
import math
import time
from pathlib import Path

import httpx

_OVERPASS_URL = "https://overpass-api.de/api/interpreter"
_CACHE_PATH = Path(__file__).resolve().parents[3] / "scripts" / ".osm_road_bearing_cache.json"
_TIMEOUT_S = 15
_last_request_time = 0.0


def _load_cache() -> dict:
    if not _CACHE_PATH.exists():
        return {}
    try:
        return json.loads(_CACHE_PATH.read_text())
    except (OSError, ValueError):
        return {}


def _save_cache(cache: dict) -> None:
    try:
        _CACHE_PATH.write_text(json.dumps(cache))
    except OSError:
        pass


_cache = _load_cache()


def _polite_delay() -> None:
    # ponytail: fixed 1s spacing, not a real rate-limit-aware client -
    # fine for a one-off seed run against the public Overpass instance.
    global _last_request_time
    elapsed = time.monotonic() - _last_request_time
    if elapsed < 1.0:
        time.sleep(1.0 - elapsed)
    _last_request_time = time.monotonic()


def _dominant_bearing_deg(lat: float, lng: float, radius_m: float) -> float | None:
    """Length-weighted dominant road bearing (0-180, direction only, no
    sense of travel) among OSM highway ways within radius_m of (lat, lng).
    """
    query = (
        f"[out:json][timeout:10];way(around:{radius_m},{lat},{lng})[highway];out geom;"
    )
    _polite_delay()
    response = httpx.post(
        _OVERPASS_URL,
        content=f"data={query}",
        headers={
            "User-Agent": "BhoomiSetu-seed-script/1.0",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        timeout=_TIMEOUT_S,
    )
    response.raise_for_status()
    elements = response.json().get("elements", [])

    lat_scale = 111320 * math.cos(math.radians(lat))
    sum_x = 0.0
    sum_y = 0.0
    for way in elements:
        geometry = way.get("geometry") or []
        for a, b in zip(geometry, geometry[1:]):
            dx = (b["lon"] - a["lon"]) * lat_scale
            dy = (b["lat"] - a["lat"]) * 110540
            length = math.hypot(dx, dy)
            if length < 1:
                continue
            # Double the angle so opposite directions of the same street
            # (0 deg and 180 deg) reinforce instead of cancelling, then
            # halve it back after summing (standard "axial" mean bearing).
            angle2 = 2 * math.atan2(dy, dx)
            sum_x += length * math.cos(angle2)
            sum_y += length * math.sin(angle2)

    if sum_x == 0 and sum_y == 0:
        return None
    dominant_rad = math.atan2(sum_y, sum_x) / 2
    return math.degrees(dominant_rad) % 180


def resolve_road_angles(lat: float, lng: float, radius_m: float, fallback_dominant_deg: float, fallback_secondary_deg: float) -> tuple[float, float]:
    """Returns (dominant_angle_deg, secondary_angle_deg) aligned with real
    OSM roads near (lat, lng), or the configured fallback angles if no
    road data is available.
    """
    cache_key = f"{lat:.4f},{lng:.4f},{int(radius_m)}"
    if cache_key in _cache:
        cached = _cache[cache_key]
        if cached is None:
            return fallback_dominant_deg, fallback_secondary_deg
        return cached, (cached + 90) % 180

    try:
        dominant = _dominant_bearing_deg(lat, lng, radius_m)
    except (httpx.HTTPError, ValueError):
        dominant = None

    _cache[cache_key] = dominant
    _save_cache(_cache)

    if dominant is None:
        return fallback_dominant_deg, fallback_secondary_deg
    return dominant, (dominant + 90) % 180
