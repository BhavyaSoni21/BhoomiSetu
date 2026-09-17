"""Ported from backend/src/common/parcel-generation/geometry.ts.

Pure polygon math for the irregular cluster-subdivision parcel generator
(cluster_generator.py). Everything here works in LOCAL METERS (x = east,
y = north, relative to a cluster's center point) rather than lng/lat, so
angle/direction math stays plain Euclidean geometry with no per-operation
latitude correction - lng/lat conversion happens once, at the very end, in
cluster_generator.py.
"""

import math
from dataclasses import dataclass

LocalPoint = tuple[float, float]
LocalRing = list[LocalPoint]  # open while under construction: no repeated first/last point

_DEDUPE_EPSILON_M = 0.01  # 1cm - collapses near-duplicate points from clip-line grazes


def _distance(a: LocalPoint, b: LocalPoint) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def dedupe_ring(ring: LocalRing) -> LocalRing:
    """Drops consecutive near-duplicate points (can appear when a clip line
    grazes close to an existing vertex) so downstream validation never sees
    a zero-length edge.
    """
    out: LocalRing = []
    for p in ring:
        if len(out) == 0 or _distance(out[-1], p) > _DEDUPE_EPSILON_M:
            out.append(p)
    if len(out) > 1 and _distance(out[0], out[-1]) <= _DEDUPE_EPSILON_M:
        out.pop()
    return out


def local_area(ring: LocalRing) -> float:
    area = 0.0
    n = len(ring)
    for i in range(n):
        x1, y1 = ring[i]
        x2, y2 = ring[(i + 1) % n]
        area += x1 * y2 - x2 * y1
    return abs(area / 2)


def local_centroid(ring: LocalRing) -> LocalPoint:
    x = sum(p[0] for p in ring)
    y = sum(p[1] for p in ring)
    n = len(ring)
    return (x / n, y / n)


def convex_polygon_min_width(ring: LocalRing) -> float:
    """The polygon's true minimum width: the smallest extent of the shape
    across ALL directions, not just axis-aligned. For a convex polygon this
    minimum is always achieved perpendicular to one of its own edges (the
    standard "rotating calipers" result), so checking just those n
    directions is exact.
    """
    n = len(ring)
    min_width = math.inf
    for i in range(n):
        a = ring[i]
        b = ring[(i + 1) % n]
        edge_len = _distance(a, b)
        if edge_len < 1e-9:
            continue
        normal: LocalPoint = (-(b[1] - a[1]) / edge_len, (b[0] - a[0]) / edge_len)
        proj_min, proj_max = math.inf, -math.inf
        for p in ring:
            proj = p[0] * normal[0] + p[1] * normal[1]
            proj_min = min(proj_min, proj)
            proj_max = max(proj_max, proj)
        width = proj_max - proj_min
        min_width = min(min_width, width)
    return min_width


@dataclass
class LocalBounds:
    min_x: float
    min_y: float
    max_x: float
    max_y: float


def local_bounds(ring: LocalRing) -> LocalBounds:
    min_x, min_y, max_x, max_y = math.inf, math.inf, -math.inf, -math.inf
    for x, y in ring:
        min_x, min_y = min(min_x, x), min(min_y, y)
        max_x, max_y = max(max_x, x), max(max_y, y)
    return LocalBounds(min_x, min_y, max_x, max_y)


# --- Convex hull (Andrew's monotone chain) ----------------------------------
# Used to turn a cloud of jittered candidate points into a guaranteed-convex
# envelope. Convexity of the envelope is what guarantees every subdivided
# leaf polygon stays simple/non-self-intersecting by construction (splitting
# a convex polygon with a straight line always yields two convex pieces).
def _cross(o: LocalPoint, a: LocalPoint, b: LocalPoint) -> float:
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])


def convex_hull(points: list[LocalPoint]) -> LocalRing:
    pts = sorted(points)
    if len(pts) < 3:
        return pts

    lower: list[LocalPoint] = []
    for p in pts:
        while len(lower) >= 2 and _cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)

    upper: list[LocalPoint] = []
    for p in reversed(pts):
        while len(upper) >= 2 and _cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)

    upper.pop()
    lower.pop()
    return lower + upper  # CCW, open ring


# --- Convex polygon half-plane clipping (Sutherland-Hodgman, single line) --
def _side(p: LocalPoint, line_point: LocalPoint, line_dir: LocalPoint) -> float:
    """"Inside" is the side where this is >= 0 (left of line_dir through line_point)."""
    return (p[0] - line_point[0]) * line_dir[1] - (p[1] - line_point[1]) * line_dir[0]


def _line_intersect(a: LocalPoint, b: LocalPoint, line_point: LocalPoint, line_dir: LocalPoint) -> LocalPoint:
    da = _side(a, line_point, line_dir)
    db = _side(b, line_point, line_dir)
    t = da / (da - db)
    return (a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]))


def split_convex_polygon(
    ring: LocalRing, line_point: LocalPoint, line_dir: LocalPoint
) -> tuple[LocalRing, LocalRing] | None:
    """Splits a convex polygon into (inside_ring, outside_ring). Both share
    the exact same two intersection points by construction. Returns None if
    the line doesn't actually cross the polygon.
    """
    inside: LocalRing = []
    outside: LocalRing = []
    n = len(ring)
    for i in range(n):
        curr = ring[i]
        nxt = ring[(i + 1) % n]
        curr_side = _side(curr, line_point, line_dir)
        next_side = _side(nxt, line_point, line_dir)

        if curr_side >= 0:
            inside.append(curr)
        if curr_side <= 0:
            outside.append(curr)

        if (curr_side > 0 and next_side < 0) or (curr_side < 0 and next_side > 0):
            intersection = _line_intersect(curr, nxt, line_point, line_dir)
            inside.append(intersection)
            outside.append(intersection)

    inside_d = dedupe_ring(inside)
    outside_d = dedupe_ring(outside)
    if len(inside_d) < 3 or len(outside_d) < 3:
        return None
    return inside_d, outside_d


def split_convex_polygon_with_gap(
    ring: LocalRing, line_point: LocalPoint, line_dir: LocalPoint, gap_meters: float
) -> tuple[LocalRing, LocalRing] | None:
    """Same idea as split_convex_polygon, but leaves a small real gap of
    gap_meters between the two children instead of an exact shared edge: the
    "outside" child keeps the original cut line, the "inside" child is
    clipped again at a second line shifted further into the inside
    half-plane by gap_meters.
    """
    # Gradient of _side() w.r.t. p is (line_dir.y, -line_dir.x) - the
    # direction in which _side() increases, i.e. toward "inside".
    inward_normal: LocalPoint = (line_dir[1], -line_dir[0])
    shifted_point: LocalPoint = (
        line_point[0] + inward_normal[0] * gap_meters,
        line_point[1] + inward_normal[1] * gap_meters,
    )

    at_original_line = split_convex_polygon(ring, line_point, line_dir)
    at_shifted_line = split_convex_polygon(ring, shifted_point, line_dir)
    if not at_original_line or not at_shifted_line:
        return None

    outside = at_original_line[1]
    inside = at_shifted_line[0]
    if len(inside) < 3 or len(outside) < 3:
        return None
    return inside, outside


def nibble_corner(ring: LocalRing, vertex_index: int, t: float) -> LocalRing:
    """Cuts one corner off a convex polygon (replacing vertex i with two
    points a short distance along its adjacent edges), turning e.g. a
    quadrilateral into a pentagon. Always yields another convex, simple
    polygon for any 0 < t < 0.5.
    """
    n = len(ring)
    prev = ring[(vertex_index - 1) % n]
    curr = ring[vertex_index]
    nxt = ring[(vertex_index + 1) % n]
    p1: LocalPoint = (curr[0] + (prev[0] - curr[0]) * t, curr[1] + (prev[1] - curr[1]) * t)
    p2: LocalPoint = (curr[0] + (nxt[0] - curr[0]) * t, curr[1] + (nxt[1] - curr[1]) * t)
    result = list(ring)
    result[vertex_index : vertex_index + 1] = [p1, p2]
    return result


# --- Validation --------------------------------------------------------------
def _segments_intersect(p1: LocalPoint, p2: LocalPoint, p3: LocalPoint, p4: LocalPoint) -> bool:
    def orientation(a: LocalPoint, b: LocalPoint, c: LocalPoint) -> int:
        val = (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1])
        if abs(val) < 1e-9:
            return 0
        return 1 if val > 0 else 2

    def on_segment(a: LocalPoint, b: LocalPoint, c: LocalPoint) -> bool:
        return (
            min(a[0], c[0]) - 1e-9 <= b[0] <= max(a[0], c[0]) + 1e-9
            and min(a[1], c[1]) - 1e-9 <= b[1] <= max(a[1], c[1]) + 1e-9
        )

    o1 = orientation(p1, p2, p3)
    o2 = orientation(p1, p2, p4)
    o3 = orientation(p3, p4, p1)
    o4 = orientation(p3, p4, p2)
    if o1 != o2 and o3 != o4:
        return True
    if o1 == 0 and on_segment(p1, p3, p2):
        return True
    if o2 == 0 and on_segment(p1, p4, p2):
        return True
    if o3 == 0 and on_segment(p3, p1, p4):
        return True
    if o4 == 0 and on_segment(p3, p2, p4):
        return True
    return False


@dataclass
class RingValidationOptions:
    min_area_sq_m: float
    max_area_sq_m: float
    min_width_meters: float


def validate_local_ring(ring: LocalRing, options: RingValidationOptions) -> str | None:
    """Every leaf ring is convex by construction (convex envelope + convex
    clipping + convexity-preserving corner nibbles), so self-intersection
    should be structurally impossible - this check is a safety net against a
    future bug in the generation pipeline, not a normal-path failure mode.
    """
    if len(ring) < 3:
        return f"fewer than 3 vertices ({len(ring)})"

    width = convex_polygon_min_width(ring)
    if width < options.min_width_meters:
        return f"sliver shape - minimum width {width:.1f}m is below the {options.min_width_meters}m floor"

    n = len(ring)
    for i in range(n):
        a1, a2 = ring[i], ring[(i + 1) % n]
        for j in range(i + 1, n):
            # Skip the edge itself and both its immediate neighbours -
            # adjacent edges always touch at that shared vertex, which
            # isn't a self-intersection.
            if j == i or j == (i + 1) % n or (j + 1) % n == i:
                continue
            b1, b2 = ring[j], ring[(j + 1) % n]
            if _segments_intersect(a1, a2, b1, b2):
                return f"self-intersecting edges {i} and {j}"

    area = local_area(ring)
    if not area > 0:
        return f"non-positive area ({area})"
    if area < options.min_area_sq_m * 0.15:
        return f"area {area:.1f}sqm is far below the expected minimum ({options.min_area_sq_m}sqm)"
    if area > options.max_area_sq_m * 4:
        return f"area {area:.1f}sqm is far above the expected maximum ({options.max_area_sq_m}sqm)"

    return None
