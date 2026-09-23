from fastapi import APIRouter, Depends, Response, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.database import get_db

router = APIRouter(prefix="/tiles", tags=["map-tiles"])


def _validate_tile(z: int, x: int, y: int):
    max_tile = 2 ** z
    if not (0 <= x < max_tile and 0 <= y < max_tile):
        raise HTTPException(400, "Invalid tile coordinates")


@router.get("/{z}/{x}/{y}.pbf")
def get_parcels_tile(z: int, x: int, y: int, db: Session = Depends(get_db)):
    """
    Returns Mapbox Vector Tile (MVT/PBF) for parcels in the given tile.
    Minimal attributes: parcel_id, canonical_parcel_id, state_code, district_code.
    """
    _validate_tile(z, x, y)

    sql = text("""
        WITH bounds AS (
            SELECT ST_Transform(ST_TileEnvelope(:z, :x, :y), 4326) AS geom
        )
        SELECT ST_AsMVT(mvt, 'parcels', 4096, 'geom')
        FROM (
            SELECT
                id AS parcel_id,
                canonical_parcel_id,
                state_code,
                district_code,
                tax_status,
                COALESCE(legal_status_severity, 0) AS legal_status_severity,
                COALESCE(value_band, 0)            AS value_band,
                COALESCE(risk_score, 0)::float     AS risk_score,
                ST_AsMVTGeom(
                    ST_Transform(geometry, 3857),
                    ST_TileEnvelope(:z, :x, :y),
                    4096,
                    64,
                    true
                ) AS geom
            FROM parcels, bounds
            WHERE geometry && bounds.geom
        ) AS mvt
    """)

    result = db.execute(sql, {"z": z, "x": x, "y": y}).scalar()

    if result is None:
        result = b""

    return Response(content=result, media_type="application/vnd.mapbox-vector-tile")


@router.get("/roads/{z}/{x}/{y}.pbf")
def get_roads_tile(
    z: int, x: int, y: int,
    state_code: str | None = Query(None),
    district: str | None = Query(None),
    road_type: str | None = Query(None),
    db: Session = Depends(get_db)
):
    """
    Returns Mapbox Vector Tile (MVT/PBF) for roads in the given tile.
    Attributes: id, name, road_type, source.
    """
    _validate_tile(z, x, y)

    where_clauses = ["rn.geometry && bounds.geom"]
    params = {"z": z, "x": x, "y": y}
    
    if state_code:
        where_clauses.append("rn.state_code = :state_code")
        params["state_code"] = state_code
    if district:
        where_clauses.append("rn.district = :district")
        params["district"] = district
    if road_type:
        where_clauses.append("rn.road_type = :road_type")
        params["road_type"] = road_type

    where_sql = " AND ".join(where_clauses)

    sql = text(f"""
        WITH bounds AS (
            SELECT ST_Transform(ST_TileEnvelope(:z, :x, :y), 4326) AS geom
        )
        SELECT ST_AsMVT(mvt, 'roads', 4096, 'geom')
        FROM (
            SELECT
                rn.id,
                rn.name,
                rn.road_type,
                rn.source,
                ST_AsMVTGeom(
                    ST_Transform(rn.geometry, 3857),
                    ST_TileEnvelope(:z, :x, :y),
                    4096,
                    64,
                    true
                ) AS geom
            FROM road_networks rn, bounds
            WHERE {where_sql}
        ) AS mvt
    """)

    result = db.execute(sql, params).scalar()

    if result is None:
        result = b""

    return Response(content=result, media_type="application/vnd.mapbox-vector-tile")


@router.get("/buildings/{z}/{x}/{y}.pbf")
def get_buildings_tile(
    z: int, x: int, y: int,
    state_code: str | None = Query(None),
    district: str | None = Query(None),
    min_confidence: float = Query(0.0, ge=0.0, le=1.0),
    db: Session = Depends(get_db)
):
    """
    Returns Mapbox Vector Tile (MVT/PBF) for buildings in the given tile.
    Attributes: id, building_type, height_m, confidence, source.
    """
    _validate_tile(z, x, y)

    where_clauses = ["bf.geometry && bounds.geom", "bf.confidence >= :min_confidence"]
    params = {"z": z, "x": x, "y": y, "min_confidence": min_confidence}
    
    if state_code:
        where_clauses.append("bf.state_code = :state_code")
        params["state_code"] = state_code
    if district:
        where_clauses.append("bf.district = :district")
        params["district"] = district

    where_sql = " AND ".join(where_clauses)

    sql = text(f"""
        WITH bounds AS (
            SELECT ST_Transform(ST_TileEnvelope(:z, :x, :y), 4326) AS geom
        )
        SELECT ST_AsMVT(mvt, 'buildings', 4096, 'geom')
        FROM (
            SELECT
                bf.id,
                bf.building_type,
                bf.height_m,
                bf.confidence,
                bf.source,
                ST_AsMVTGeom(
                    ST_Transform(bf.geometry, 3857),
                    ST_TileEnvelope(:z, :x, :y),
                    4096,
                    64,
                    true
                ) AS geom
            FROM building_footprints bf, bounds
            WHERE {where_sql}
        ) AS mvt
    """)

    result = db.execute(sql, params).scalar()

    if result is None:
        result = b""

    return Response(content=result, media_type="application/vnd.mapbox-vector-tile")


@router.get("/landcover/{z}/{x}/{y}.pbf")
def get_landcover_tile(
    z: int, x: int, y: int,
    state_code: str | None = Query(None),
    district: str | None = Query(None),
    year: int = Query(2026),
    class_code: int | None = Query(None),
    db: Session = Depends(get_db)
):
    """
    Returns Mapbox Vector Tile (MVT/PBF) for land cover in the given tile.
    Attributes: id, class_code, class_name, year, source.
    Note: Land cover is stored as stats per district, not polygons.
    This endpoint returns simplified district-level land cover for visualization.
    """
    _validate_tile(z, x, y)

    where_clauses = ["lc.geometry && bounds.geom", "lc.year = :year"]
    params = {"z": z, "x": x, "y": y, "year": year}
    
    if state_code:
        where_clauses.append("lc.state_code = :state_code")
        params["state_code"] = state_code
    if district:
        where_clauses.append("lc.district = :district")
        params["district"] = district
    if class_code:
        where_clauses.append("lc.class_code = :class_code")
        params["class_code"] = class_code

    where_sql = " AND ".join(where_clauses)

    sql = text(f"""
        WITH bounds AS (
            SELECT ST_Transform(ST_TileEnvelope(:z, :x, :y), 4326) AS geom
        )
        SELECT ST_AsMVT(mvt, 'landcover', 4096, 'geom')
        FROM (
            SELECT
                lc.id,
                lc.class_code,
                lc.class_name,
                lc.year,
                lc.source,
                ST_AsMVTGeom(
                    ST_Transform(lc.geometry, 3857),
                    ST_TileEnvelope(:z, :x, :y),
                    4096,
                    64,
                    true
                ) AS geom
            FROM land_cover lc, bounds
            WHERE {where_sql}
        ) AS mvt
    """)

    result = db.execute(sql, params).scalar()

    if result is None:
        result = b""

    return Response(content=result, media_type="application/vnd.mapbox-vector-tile")


@router.get("/elevation/{z}/{x}/{y}.pbf")
def get_elevation_tile(
    z: int, x: int, y: int,
    state_code: str | None = Query(None),
    district: str | None = Query(None),
    db: Session = Depends(get_db)
):
    """
    Returns Mapbox Vector Tile (MVT/PBF) for elevation tiles in the given tile.
    Attributes: id, mean_elevation_m, mean_slope_deg, max_slope_deg, source.
    """
    _validate_tile(z, x, y)

    where_clauses = ["et.geometry && bounds.geom"]
    params = {"z": z, "x": x, "y": y}
    
    if state_code:
        where_clauses.append("et.state_code = :state_code")
        params["state_code"] = state_code
    if district:
        where_clauses.append("et.district = :district")
        params["district"] = district

    where_sql = " AND ".join(where_clauses)

    sql = text(f"""
        WITH bounds AS (
            SELECT ST_Transform(ST_TileEnvelope(:z, :x, :y), 4326) AS geom
        )
        SELECT ST_AsMVT(mvt, 'elevation', 4096, 'geom')
        FROM (
            SELECT
                et.id,
                et.mean_elevation_m,
                et.mean_slope_deg,
                et.max_slope_deg,
                et.source,
                ST_AsMVTGeom(
                    ST_Transform(et.geometry, 3857),
                    ST_TileEnvelope(:z, :x, :y),
                    4096,
                    64,
                    true
                ) AS geom
            FROM elevation_tiles et, bounds
            WHERE {where_sql}
        ) AS mvt
    """)

    result = db.execute(sql, params).scalar()

    if result is None:
        result = b""

    return Response(content=result, media_type="application/vnd.mapbox-vector-tile")