from app.database import get_db
from sqlalchemy import text

db = next(get_db())
# Test MVT query with the correct tile
result = db.execute(text("""
    SELECT ST_AsMVT(mvt, 'parcels', 4096, 'geom')
    FROM (
        SELECT
            id AS parcel_id,
            canonical_parcel_id,
            state_code,
            district_code,
            ST_AsMVTGeom(
                geometry,
                ST_TileEnvelope(4, 8, 7),
                4096, 64, true
            ) AS geom
        FROM parcels
        WHERE geometry && ST_TileEnvelope(4, 8, 7)
    ) AS mvt
"""))
tile_data = result.scalar()
print(f'MVT tile data: {len(tile_data)} bytes' if tile_data else 'No data')