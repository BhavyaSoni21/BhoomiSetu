"""Ported from backend/src/common/parcel-generation/cluster-generator.ts.

Topology-aware irregular cadastral-subdivision generator. Each cluster gets
its own irregular convex envelope (an urban-block-shaped footprint,
oriented along a per-cluster "dominant road angle" - no real road layer
exists to read, so this is a configured stand-in), which is then
recursively split into `parcel_count` irregular leaf polygons - triangles
through hexagons, varied sizes, mostly exact shared edges with an
occasional small gap.
"""

import math
import random
from dataclasses import dataclass, replace

from .osm_roads import resolve_road_angles
from .geometry import (
    LocalPoint,
    LocalRing,
    RingValidationOptions,
    convex_hull,
    convex_polygon_min_width,
    dedupe_ring,
    local_area,
    local_bounds,
    local_centroid,
    nibble_corner,
    split_convex_polygon,
    split_convex_polygon_with_gap,
    validate_local_ring,
)

Point = tuple[float, float]  # lng/lat
Ring = list[Point]  # lng/lat, closed (first == last)


@dataclass
class ClusterGeometryConfig:
    cluster_id: str
    state_code: str
    district: str
    center_lng: float
    center_lat: float
    parcel_count: int
    # Degrees, 0 = due east, 90 = due north. Stands in for "local road
    # direction" - no real road geometry is available to this seed script.
    dominant_angle_deg: float
    # Roughly dominant+90, independently jittered so cross-cuts aren't a
    # perfect right angle - what keeps the subdivision from reading as a grid.
    secondary_angle_deg: float
    # Candidate point count fed to the convex hull; the hull itself may end
    # up with fewer vertices. 3-8 gives triangular-through-octagonal
    # irregular envelopes.
    envelope_sides: int
    # Nominal circular-equivalent radius before elongation, in meters.
    radius_meters: float
    # >1 elongates the envelope along the dominant axis.
    aspect_ratio: float
    min_parcel_area_sq_m: float
    max_parcel_area_sq_m: float
    # Fraction of internal splits that get a small real gap instead of an
    # exact shared edge.
    gap_probability: float
    gap_meters: float


def _auto_config(cluster_id: str, state_code: str, district: str, center_lng: float, center_lat: float, *, is_village: bool) -> ClusterGeometryConfig:
    """Default-tuned config for the one-city + one-village-per-state
    coverage below. dominant_angle_deg here is only the pre-OSM fallback -
    generate_cluster_parcels() overwrites it with the real road bearing at
    (center_lat, center_lng) when Overpass has data for the area.
    """
    # Deterministic per-cluster jitter (not random-seeded) so re-running
    # the seed script doesn't reshuffle which clusters look "similar".
    seed = sum(cluster_id.encode())
    angle = seed % 180
    if is_village:
        return ClusterGeometryConfig(
            cluster_id=cluster_id, state_code=state_code, district=district,
            center_lng=center_lng, center_lat=center_lat,
            parcel_count=40, dominant_angle_deg=angle, secondary_angle_deg=(angle + 90) % 180,
            envelope_sides=5, radius_meters=750, aspect_ratio=1.2,
            min_parcel_area_sq_m=15000, max_parcel_area_sq_m=60000,
            gap_probability=0.08, gap_meters=5,
        )
    return ClusterGeometryConfig(
        cluster_id=cluster_id, state_code=state_code, district=district,
        center_lng=center_lng, center_lat=center_lat,
        parcel_count=100, dominant_angle_deg=angle, secondary_angle_deg=(angle + 90) % 180,
        envelope_sides=7, radius_meters=1050, aspect_ratio=1.5,
        min_parcel_area_sq_m=10000, max_parcel_area_sq_m=45000,
        gap_probability=0.1, gap_meters=6,
    )


# One city + one village per Indian state (28 states; Delhi/Chandigarh
# above are the two union-territory pilots, kept as-is). City = state
# capital (or largest metro, when the notional capital is a planned/low-OSM-
# density city). Village = a real point offset from the capital rather than
# a named settlement, since a specific village's exact coordinates aren't
# reliably known here - real coordinates either way, resolve_road_angles()
# reads whatever OSM road data actually exists at that point.
_STATE_CAPITALS: list[tuple[str, str, float, float]] = [
    ("AP", "Vijayawada", 80.6480, 16.5062),
    ("AR", "Itanagar", 93.6053, 27.0844),
    ("AS", "Guwahati", 91.7362, 26.1445),
    ("BR", "Patna", 85.1376, 25.5941),
    ("CG", "Raipur", 81.6296, 21.2514),
    ("GA", "Panaji", 73.8278, 15.4909),
    ("GJ", "Ahmedabad", 72.5714, 23.0225),
    ("HR", "Gurugram", 77.0266, 28.4595),
    ("HP", "Shimla", 77.1734, 31.1048),
    ("JH", "Ranchi", 85.3096, 23.3441),
    ("KL", "Thiruvananthapuram", 76.9366, 8.5241),
    ("MP", "Bhopal", 77.4126, 23.2599),
    ("MN", "Imphal", 93.9368, 24.8170),
    ("ML", "Shillong", 91.8933, 25.5788),
    ("MZ", "Aizawl", 92.7176, 23.7271),
    ("NL", "Kohima", 94.1086, 25.6751),
    ("OD", "Bhubaneswar", 85.8245, 20.2961),
    ("PB", "Ludhiana", 75.8573, 30.9010),
    ("RJ", "Jaipur", 75.7873, 26.9124),
    ("SK", "Gangtok", 88.6065, 27.3389),
    ("TG", "Hyderabad", 78.4867, 17.3850),
    ("TR", "Agartala", 91.2868, 23.8315),
    ("UP", "Lucknow", 80.9462, 26.8467),
    ("UK", "Dehradun", 78.0322, 30.3165),
    ("WB", "Kolkata", 88.3639, 22.5726),
]

# Village offset: ~28km from the capital at a per-state bearing (derived
# from the state code so it's fixed, not random) - lands in real
# countryside around most capitals without asserting a specific village name.
def _village_point(lng: float, lat: float, state_code: str) -> tuple[float, float]:
    bearing_deg = (sum(state_code.encode()) * 37) % 360
    bearing_rad = math.radians(bearing_deg)
    dx_m, dy_m = 28000 * math.sin(bearing_rad), 28000 * math.cos(bearing_rad)
    lng_scale = 111320 * math.cos(math.radians(lat))
    return lng + dx_m / lng_scale, lat + dy_m / 110540


_AUTO_CLUSTER_CONFIGS: list[ClusterGeometryConfig] = []
for _state_code, _city_name, _city_lng, _city_lat in _STATE_CAPITALS:
    _AUTO_CLUSTER_CONFIGS.append(_auto_config(f"{_state_code}-{_city_name.upper()}-01", _state_code, _city_name, _city_lng, _city_lat, is_village=False))
    _village_lng, _village_lat = _village_point(_city_lng, _city_lat, _state_code)
    _AUTO_CLUSTER_CONFIGS.append(_auto_config(f"{_state_code}-VILLAGE-01", _state_code, f"{_city_name} Rural", _village_lng, _village_lat, is_village=True))

# Villages for the three states that already have a hand-tuned city cluster below.
for _state_code, _city_lng, _city_lat, _district in [("MH", 73.8567, 18.5204, "Pune"), ("TN", 80.2707, 13.0827, "Chennai"), ("KA", 77.5946, 12.9716, "Bangalore")]:
    _village_lng, _village_lat = _village_point(_city_lng, _city_lat, _state_code)
    _AUTO_CLUSTER_CONFIGS.append(_auto_config(f"{_state_code}-VILLAGE-01", _state_code, f"{_district} Rural", _village_lng, _village_lat, is_village=True))


# Five hand-tuned clusters, each with a genuinely different orientation/envelope
# shape/density/gap frequency rather than one template moved around.
CLUSTER_CONFIGS: list[ClusterGeometryConfig] = [
    ClusterGeometryConfig(
        cluster_id="MH-PUNE-01", state_code="MH", district="Pune", center_lng=73.8567, center_lat=18.5204,
        parcel_count=100, dominant_angle_deg=22, secondary_angle_deg=118, envelope_sides=7,
        radius_meters=1050, aspect_ratio=1.55, min_parcel_area_sq_m=11000, max_parcel_area_sq_m=46000,
        gap_probability=0.12, gap_meters=6,
    ),
    ClusterGeometryConfig(
        cluster_id="TN-CHENNAI-01", state_code="TN", district="Chennai", center_lng=80.2707, center_lat=13.0827,
        parcel_count=40, dominant_angle_deg=97, secondary_angle_deg=4, envelope_sides=5,
        radius_meters=680, aspect_ratio=1.35, min_parcel_area_sq_m=10000, max_parcel_area_sq_m=40000,
        gap_probability=0.08, gap_meters=5,
    ),
    ClusterGeometryConfig(
        cluster_id="KA-BANGALORE-01", state_code="KA", district="Bangalore", center_lng=77.5946, center_lat=12.9716,
        parcel_count=40, dominant_angle_deg=58, secondary_angle_deg=152, envelope_sides=6,
        radius_meters=680, aspect_ratio=1.7, min_parcel_area_sq_m=9000, max_parcel_area_sq_m=42000,
        gap_probability=0.16, gap_meters=7,
    ),
    ClusterGeometryConfig(
        cluster_id="DL-NEWDELHI-01", state_code="DL", district="New Delhi", center_lng=77.209, center_lat=28.6139,
        parcel_count=20, dominant_angle_deg=-18, secondary_angle_deg=71, envelope_sides=4,
        radius_meters=480, aspect_ratio=1.2, min_parcel_area_sq_m=12000, max_parcel_area_sq_m=44000,
        gap_probability=0.1, gap_meters=5,
    ),
    # Chandigarh: one of the two real pilot locations named in the fuller
    # "Land Stack" text - previously absent from the seed dataset entirely.
    ClusterGeometryConfig(
        cluster_id="CH-CHANDIGARH-01", state_code="CH", district="Chandigarh", center_lng=76.7794, center_lat=30.7333,
        parcel_count=20, dominant_angle_deg=45, secondary_angle_deg=135, envelope_sides=4,
        radius_meters=460, aspect_ratio=1.05, min_parcel_area_sq_m=10000, max_parcel_area_sq_m=38000,
        gap_probability=0.1, gap_meters=5,
    ),
]

CLUSTER_CONFIGS.extend(_AUTO_CLUSTER_CONFIGS)


@dataclass
class GeneratedParcel:
    ring: Ring  # lng/lat, closed
    area_sq_m: float
    centroid: Point  # lng/lat


def _meters_per_degree(ref_lat: float) -> tuple[float, float]:
    """Returns (lat, lng) meters-per-degree."""
    return 110540, 111320 * math.cos((ref_lat * math.pi) / 180)


def _deg_to_rad(deg: float) -> float:
    return (deg * math.pi) / 180


def _build_envelope(config: ClusterGeometryConfig) -> LocalRing:
    """STEP 1+2: an irregular convex envelope standing in for "the urban
    block bounded by nearby roads". Built from jittered points around an
    ellipse elongated along dominant_angle_deg, then hulled - the hull
    guarantees convexity regardless of how much the jitter perturbs
    individual points.
    """
    dominant_rad = _deg_to_rad(config.dominant_angle_deg)
    rx = config.radius_meters * math.sqrt(config.aspect_ratio)
    ry = config.radius_meters / math.sqrt(config.aspect_ratio)
    candidate_count = max(config.envelope_sides, 6) + 2

    candidates: list[LocalPoint] = []
    for k in range(candidate_count):
        theta = (k / candidate_count) * 2 * math.pi + (random.random() - 0.5) * ((2 * math.pi) / candidate_count) * 0.6
        radial_jitter = 0.72 + random.random() * 0.45  # 0.72x-1.17x
        local_x = math.cos(theta) * rx * radial_jitter
        local_y = math.sin(theta) * ry * radial_jitter
        # Rotate so the ellipse's long axis aligns with the dominant angle.
        x = local_x * math.cos(dominant_rad) - local_y * math.sin(dominant_rad)
        y = local_x * math.sin(dominant_rad) + local_y * math.cos(dominant_rad)
        candidates.append((x, y))
    return convex_hull(candidates)


# Neither child of a split may end up smaller than this fraction of the
# parent's area, NOR narrower than MIN_PARCEL_WIDTH_METERS in its thinnest
# direction.
_MIN_SPLIT_RATIO = 0.22
_MIN_PARCEL_WIDTH_METERS = 22
_MAX_SPLIT_ATTEMPTS = 14

# Bounding width against sqrt(area) bounds the aspect ratio directly
# regardless of the parcel's absolute scale: 0.42 caps the long:short side
# ratio at roughly 6:1 for a rectangle-like shape.
_MIN_COMPACTNESS = 0.42


def _is_reasonably_compact(ring: LocalRing) -> bool:
    width = convex_polygon_min_width(ring)
    if width < _MIN_PARCEL_WIDTH_METERS:
        return False
    return width >= _MIN_COMPACTNESS * math.sqrt(local_area(ring))


def _split_balanced(target: LocalRing, config: ClusterGeometryConfig) -> tuple[LocalRing, LocalRing]:
    target_area = local_area(target)
    centroid = local_centroid(target)
    bounds = local_bounds(target)
    extent = max(bounds.max_x - bounds.min_x, bounds.max_y - bounds.min_y)

    for attempt in range(_MAX_SPLIT_ATTEMPTS):
        use_secondary_axis = random.random() < 0.4
        base_angle = config.secondary_angle_deg if use_secondary_axis else config.dominant_angle_deg
        angle_rad = _deg_to_rad(base_angle + (random.random() - 0.5) * 24)
        direction: LocalPoint = (math.cos(angle_rad), math.sin(angle_rad))
        normal: LocalPoint = (-direction[1], direction[0])

        # Shrink the allowed offset range on later attempts, converging
        # toward a centered (well-balanced) cut if earlier wider attempts
        # all produced too lopsided a split.
        max_offset_frac = 0.26 * (1 - attempt / _MAX_SPLIT_ATTEMPTS)
        offset_frac = (random.random() * 2 - 1) * max_offset_frac
        line_point: LocalPoint = (
            centroid[0] + normal[0] * extent * offset_frac,
            centroid[1] + normal[1] * extent * offset_frac,
        )

        use_gap = random.random() < config.gap_probability
        children = (
            split_convex_polygon_with_gap(target, line_point, direction, config.gap_meters)
            if use_gap
            else split_convex_polygon(target, line_point, direction)
        )
        if not children:
            continue

        min_ratio = min(local_area(children[0]), local_area(children[1])) / target_area
        if min_ratio < _MIN_SPLIT_RATIO:
            continue
        if not all(_is_reasonably_compact(c) for c in children):
            continue
        return children

    # A line through the true centroid of a convex polygon always crosses
    # its boundary exactly twice, so this is guaranteed to succeed (though
    # not guaranteed to clear the width floor - the whole-cluster retry in
    # generate_cluster_parcels is what backstops that rare case).
    angle_rad = _deg_to_rad(config.dominant_angle_deg)
    fallback = split_convex_polygon(target, centroid, (math.cos(angle_rad), math.sin(angle_rad)))
    if not fallback:
        raise RuntimeError(
            f"parcel-generation: failed to split a polygon in cluster {config.cluster_id} even via the centroid fallback"
        )
    return fallback


def _subdivide_envelope(envelope: LocalRing, config: ClusterGeometryConfig) -> list[LocalRing]:
    """STEP 3+4: recursively split the envelope into exactly parcel_count
    leaf polygons. Always splits the current-largest piece (a greedy
    balanced space partition) - this alone produces natural size variance.
    """
    pending: list[LocalRing] = [envelope]

    while len(pending) < config.parcel_count:
        target_index = max(range(len(pending)), key=lambda i: local_area(pending[i]))
        children = _split_balanced(pending[target_index], config)
        pending[target_index : target_index + 1] = [children[0], children[1]]

    return pending


_NIBBLE_PROBABILITY = 0.35


def _apply_corner_nibbles(leaves: list[LocalRing]) -> list[LocalRing]:
    """STEP 4 (vertex variety): cuts one corner off a random subset of
    leaves. Only ever targets a vertex whose coordinate isn't used by any
    other leaf in the cluster, so nibbling can never silently turn an
    intended TOUCHING edge into a gap or overlap.
    """

    def key_of(p: LocalPoint) -> str:
        return f"{p[0]:.2f}:{p[1]:.2f}"  # 1cm precision in local meters

    usage_count: dict[str, int] = {}
    for ring in leaves:
        for p in ring:
            k = key_of(p)
            usage_count[k] = usage_count.get(k, 0) + 1

    result: list[LocalRing] = []
    for ring in leaves:
        if random.random() > _NIBBLE_PROBABILITY:
            result.append(ring)
            continue
        safe_indices = [i for i in range(len(ring)) if usage_count.get(key_of(ring[i]), 0) == 1]
        if not safe_indices:
            result.append(ring)
            continue
        vertex_index = random.choice(safe_indices)
        t = 0.15 + random.random() * 0.15  # shave 15%-30% off each adjacent edge
        nibbled = dedupe_ring(nibble_corner(ring, vertex_index, t))
        # A corner nibble can't create a sliver in the general case, but
        # skip it anyway if it would push this leaf below the compactness
        # bar, rather than risk it.
        result.append(nibbled if _is_reasonably_compact(nibbled) else ring)
    return result


def _to_generated_parcel(local_ring: LocalRing, config: ClusterGeometryConfig) -> GeneratedParcel:
    area_sq_m = local_area(local_ring)
    m_per_lat, m_per_lng = _meters_per_degree(config.center_lat)
    lng_lat_ring: Ring = [(config.center_lng + x / m_per_lng, config.center_lat + y / m_per_lat) for x, y in local_ring]
    closed: Ring = [*lng_lat_ring, lng_lat_ring[0]]
    open_ring = closed[:-1]
    centroid: Point = (
        sum(p[0] for p in open_ring) / len(open_ring),
        sum(p[1] for p in open_ring) / len(open_ring),
    )
    return GeneratedParcel(ring=closed, area_sq_m=area_sq_m, centroid=centroid)


_MAX_CLUSTER_ATTEMPTS = 5


def _attempt_generate_cluster_parcels(config: ClusterGeometryConfig) -> list[GeneratedParcel]:
    envelope = _build_envelope(config)
    leaves = _subdivide_envelope(envelope, config)
    nibbled = _apply_corner_nibbles(leaves)

    for i, ring in enumerate(nibbled):
        problem = validate_local_ring(
            ring,
            RingValidationOptions(
                min_area_sq_m=config.min_parcel_area_sq_m,
                max_area_sq_m=config.max_parcel_area_sq_m,
                min_width_meters=_MIN_PARCEL_WIDTH_METERS,
            ),
        )
        if problem:
            raise RuntimeError(f"invalid parcel #{i} in cluster {config.cluster_id}: {problem}")
        if not _is_reasonably_compact(ring):
            raise RuntimeError(f"invalid parcel #{i} in cluster {config.cluster_id}: too elongated (ribbon-like) relative to its area")

    return [_to_generated_parcel(ring, config) for ring in nibbled]


def generate_cluster_parcels(config: ClusterGeometryConfig) -> list[GeneratedParcel]:
    """Full pipeline for one cluster: cluster -> envelope -> subdivision ->
    parcels -> validate. Every step involves randomness, so this retries the
    *entire* cluster a bounded number of times before genuinely failing -
    regenerating is cheap and simpler than patching a single bad leaf.
    """
    dominant, secondary = resolve_road_angles(
        config.center_lat, config.center_lng, config.radius_meters,
        config.dominant_angle_deg, config.secondary_angle_deg,
    )
    road_aware_config = replace(config, dominant_angle_deg=dominant, secondary_angle_deg=secondary)

    last_error: Exception | None = None
    for _ in range(_MAX_CLUSTER_ATTEMPTS):
        try:
            return _attempt_generate_cluster_parcels(road_aware_config)
        except Exception as error:  # noqa: BLE001
            last_error = error
    raise RuntimeError(
        f"parcel-generation: cluster {config.cluster_id} failed validation {_MAX_CLUSTER_ATTEMPTS} times in a row: {last_error}"
    )
