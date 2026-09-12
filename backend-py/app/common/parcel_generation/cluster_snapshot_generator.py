"""Ported from backend/src/common/parcel-generation/cluster-snapshot-generator.ts.

Historical parcel-imagery comparison - "simplified server-rendered
polygons" rather than a live headless-browser map screenshot: each
cluster's real, already-saved parcel boundaries (lng/lat) rendered as a
flat SVG of colored polygons, then rasterized (cairosvg here, sharp on the
NestJS side - same SVG-to-PNG approach). Every year for a given cluster
uses the identical bounding box, computed once from the cluster's own
parcels - the deliberate simplification that avoids needing any
image-registration/alignment step before comparing two years.
"""

import math
from dataclasses import dataclass
from xml.sax.saxutils import escape

import cairosvg

from .cluster_generator import Ring
from .parcel_category import CATEGORY_COLORS, ParcelCategory

SNAPSHOT_SIZE = 512
_STROKE = "#1f2417"


@dataclass
class ClusterBounds:
    min_lng: float
    min_lat: float
    max_lng: float
    max_lat: float


def compute_cluster_bounds(rings: list[Ring]) -> ClusterBounds:
    min_lng, min_lat, max_lng, max_lat = math.inf, math.inf, -math.inf, -math.inf
    for ring in rings:
        for lng, lat in ring:
            min_lng, max_lng = min(min_lng, lng), max(max_lng, lng)
            min_lat, max_lat = min(min_lat, lat), max(max_lat, lat)
    # A small margin so edge parcels aren't clipped flush against the image
    # border - purely cosmetic, doesn't affect the bounds stored/used for
    # pixel<->geo mapping (that math accounts for the same margin, see
    # _project_ring below).
    margin_frac = 0.04
    lng_pad = (max_lng - min_lng) * margin_frac or 0.001
    lat_pad = (max_lat - min_lat) * margin_frac or 0.001
    return ClusterBounds(min_lng - lng_pad, min_lat - lat_pad, max_lng + lng_pad, max_lat + lat_pad)


def _project_ring(ring: Ring, bounds: ClusterBounds, size: int) -> str:
    points = []
    for lng, lat in ring:
        x = ((lng - bounds.min_lng) / (bounds.max_lng - bounds.min_lng)) * size
        # Image y grows downward; latitude grows upward - flip.
        y = ((bounds.max_lat - lat) / (bounds.max_lat - bounds.min_lat)) * size
        points.append(f"{x:.1f},{y:.1f}")
    return " ".join(points)


def render_cluster_snapshot(rings: list[Ring], bounds: ClusterBounds, categories: list[ParcelCategory]) -> bytes:
    """`categories[i]` is the real, data-driven ParcelCategory for
    `rings[i]` in this particular year's render - the same function the
    change-detection comparison uses to decide which parcels changed
    between two years, so the rendered color and the "what's different"
    detection can never disagree.
    """
    polygons = []
    for ring, category in zip(rings, categories, strict=True):
        fill = CATEGORY_COLORS.get(category, CATEGORY_COLORS["NONE"])
        points = escape(_project_ring(ring, bounds, SNAPSHOT_SIZE))
        polygons.append(f'<polygon points="{points}" fill="{fill}" stroke="{_STROKE}" stroke-width="1.5" />')

    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{SNAPSHOT_SIZE}" height="{SNAPSHOT_SIZE}">'
        f'<rect width="100%" height="100%" fill="#f4f1ea" />{"".join(polygons)}</svg>'
    )
    return cairosvg.svg2png(bytestring=svg.encode("utf-8"))
