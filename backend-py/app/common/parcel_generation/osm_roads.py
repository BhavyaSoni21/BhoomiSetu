"""Real road orientation lookup via local OSM PBF roads in PostGIS.

Replaces the configured `dominant_angle_deg`/`secondary_angle_deg` stand-in
on a ClusterGeometryConfig with the actual dominant road bearing near that
cluster's center, so generated parcel envelopes/splits line up with real
streets instead of an arbitrary angle. Falls back to the configured angle
whenever no roads are found nearby - per the seed-pipeline requirement that
missing external data must never crash seeding.

Uses the road_networks table populated by scripts/extract_osm_roads.py
from Geofabrik PBF files (zero-cost, no API calls).
"""

import math
from typing import Optional
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.terrain import RoadNetwork


def _dominant_bearing_from_local_roads(lat: float, lng: float, radius_m: float, db: Session) -> Optional[float]:
    """Length-weighted dominant road bearing (0-180) from local PBF roads
    within radius_m of (lat, lng). Returns None if no roads found.
    """
    # Convert radius to degrees (approximate)
    lat_deg_per_m = 1.0 / 110540
    lng_deg_per_m = 1.0 / (111320 * math.cos(math.radians(lat)))
    radius_deg_lat = radius_m * lat_deg_per_m
    radius_deg_lng = radius_m * lng_deg_per_m

    # Query roads within bounding box (fast index scan), then filter by actual distance
    stmt = select(
        RoadNetwork.geometry.ST_AsText(),
        RoadNetwork.road_type,
        func.ST_Distance(
            RoadNetwork.geometry,
            func.ST_SetSRID(func.ST_MakePoint(lng, lat), 4326)
        ).label('dist_m')
    ).where(
        RoadNetwork.state_code.isnot(None),
        RoadNetwork.geometry.ST_Intersects(
            func.ST_MakeEnvelope(
                lng - radius_deg_lng, lat - radius_deg_lat,
                lng + radius_deg_lng, lat + radius_deg_lat,
                4326
            )
        )
    )

    results = db.execute(stmt).all()

    if not results:
        return None

    lat_scale = 111320 * math.cos(math.radians(lat))
    sum_x = 0.0
    sum_y = 0.0
    total_length = 0.0

    for row in results:
        wkt = row[0]
        road_type = row[1]
        dist_m = row[2]

        if dist_m > radius_m:
            continue

        # Parse WKT LINESTRING
        import re
        match = re.search(r'LINESTRING\s*\((.+)\)', wkt)
        if not match:
            continue
        coords_str = match.group(1)
        coords = []
        for pair in coords_str.split(','):
            lon_str, lat_str = pair.strip().split()
            coords.append((float(lon_str), float(lat_str)))

        if len(coords) < 2:
            continue

        # Weight by road type importance
        type_weight = {
            'HIGHWAY': 3.0,
            'PRIMARY': 2.5,
            'SECONDARY': 2.0,
            'TERTIARY': 1.5,
            'RESIDENTIAL': 1.0,
            'SERVICE': 0.5,
            'UNCLASSIFIED': 0.5,
            'TRACK': 0.3,
        }.get(road_type, 1.0)

        for a, b in zip(coords, coords[1:]):
            dx = (b[0] - a[0]) * lat_scale
            dy = (b[1] - a[1]) * 110540
            length = math.hypot(dx, dy)
            if length < 1:
                continue
            angle2 = 2 * math.atan2(dy, dx)
            sum_x += length * type_weight * math.cos(angle2)
            sum_y += length * type_weight * math.sin(angle2)
            total_length += length * type_weight

    if total_length == 0:
        return None

    dominant_rad = math.atan2(sum_y, sum_x) / 2
    return math.degrees(dominant_rad) % 180


def resolve_road_angles(lat: float, lng: float, radius_m: float, fallback_dominant_deg: float, fallback_secondary_deg: float) -> tuple[float, float]:
    """Returns (dominant_angle_deg, secondary_angle_deg) aligned with real
    local OSM PBF roads near (lat, lng), or the configured fallback angles if no
    road data is available.
    """
    db = SessionLocal()
    try:
        dominant = _dominant_bearing_from_local_roads(lat, lng, radius_m, db)
    except Exception:
        dominant = None
    finally:
        db.close()

    if dominant is None:
        return fallback_dominant_deg, fallback_secondary_deg
    return dominant, (dominant + 90) % 180
