"""Partial port of backend/src/common/geo-utils.ts.

Only `point_in_ring` and `polygon_distance_meters` - the two functions
seed.py itself genuinely needs (flood-zone membership, TOUCHING/NEARBY
neighbour classification) at generation time, working in local-meter
planar approximation exactly like the TS version. The rest of geo-utils.ts
(`ringsOverlap` etc.) existed only to give backend/'s SQLite driver a
fallback for live API queries real PostGIS otherwise answers with
ST_Touches/ST_DWithin - backend-py has no SQLite driver, so those live
queries just use PostGIS/GeoAlchemy2 directly once the modules that need
them (GisModule/SpatialModule/ParcelsModule) are built, and don't need a
ported fallback.
"""

import math

Ring = list[tuple[float, float]]
Point = tuple[float, float]


def point_in_ring(point: Point, ring: Ring) -> bool:
    x, y = point
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i]
        xj, yj = ring[j]
        intersects = (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi
        if intersects:
            inside = not inside
        j = i
    return inside


def _meters_per_degree(ref_lat: float) -> tuple[float, float]:
    return 110540, 111320 * math.cos((ref_lat * math.pi) / 180)


def _to_local_meters(ring: Ring, ref_lat: float) -> Ring:
    m_per_lat, m_per_lng = _meters_per_degree(ref_lat)
    return [(x * m_per_lng, y * m_per_lat) for x, y in ring]


def _point_segment_distance(p: Point, a: Point, b: Point) -> float:
    px, py = p
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    length_sq = dx * dx + dy * dy
    t = 0.0 if length_sq == 0 else ((px - ax) * dx + (py - ay) * dy) / length_sq
    t = max(0.0, min(1.0, t))
    cx, cy = ax + t * dx, ay + t * dy
    return math.hypot(px - cx, py - cy)


def _orientation(a: Point, b: Point, c: Point) -> int:
    val = (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1])
    if abs(val) < 1e-9:
        return 0
    return 1 if val > 0 else 2


def _on_segment(a: Point, b: Point, c: Point) -> bool:
    return (
        min(a[0], c[0]) - 1e-9 <= b[0] <= max(a[0], c[0]) + 1e-9
        and min(a[1], c[1]) - 1e-9 <= b[1] <= max(a[1], c[1]) + 1e-9
    )


def _segments_intersect(p1: Point, p2: Point, p3: Point, p4: Point) -> bool:
    o1, o2 = _orientation(p1, p2, p3), _orientation(p1, p2, p4)
    o3, o4 = _orientation(p3, p4, p1), _orientation(p3, p4, p2)
    if o1 != o2 and o3 != o4:
        return True
    if o1 == 0 and _on_segment(p1, p3, p2):
        return True
    if o2 == 0 and _on_segment(p1, p4, p2):
        return True
    if o3 == 0 and _on_segment(p3, p1, p4):
        return True
    if o4 == 0 and _on_segment(p3, p2, p4):
        return True
    return False


def _segment_distance(a1: Point, a2: Point, b1: Point, b2: Point) -> float:
    if _segments_intersect(a1, a2, b1, b2):
        return 0.0
    return min(
        _point_segment_distance(a1, b1, b2),
        _point_segment_distance(a2, b1, b2),
        _point_segment_distance(b1, a1, a2),
        _point_segment_distance(b2, a1, a2),
    )


def polygon_distance_meters(ring_a: Ring, ring_b: Ring, ref_lat: float) -> float:
    """Shortest distance in metres between two polygon rings (edge-to-edge,
    accounting for containment/overlap as 0), projected locally around
    ref_lat.
    """
    a = _to_local_meters(ring_a, ref_lat)
    b = _to_local_meters(ring_b, ref_lat)

    if point_in_ring(a[0], b) or point_in_ring(b[0], a):
        return 0.0

    minimum = math.inf
    for i in range(len(a) - 1):
        for j in range(len(b) - 1):
            d = _segment_distance(a[i], a[i + 1], b[j], b[j + 1])
            minimum = min(minimum, d)
            if minimum == 0:
                return 0.0
    return minimum
