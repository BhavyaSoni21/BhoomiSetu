from app.database import get_db
from sqlalchemy import text

db = next(get_db())
# Test MVT query with coordinate transformation
result = db.execute(text("""
    WITH bounds AS (
        SELECT ST_Transform(ST_TileEnvelope(4, 8, 7), 4326) AS geom
    )
    SELECT ST_AsMVT(mvt, 'parcels', 4096, 'geom')
    FROM (
        SELECT
            id AS parcel_id,
            canonical_parcel_id,
            state_code,
            district_code,
            ST_AsMVTGeom(
                ST_Transform(geometry, 3857),
                ST_TileEnvelope(4, 8, 7),
                4096, 64, true
            ) AS geom
        FROM parcels, bounds
        WHERE geometry && bounds.geom
    ) AS mvt
"""))
tile_data = result.scalar()
print(f'MVT tile data: {len(tile_data)} bytes' if tile_data else 'No data')