from app.database import get_db
from sqlalchemy import text

db = next(get_db())
# Get overall bounds of all parcels
result = db.execute(text("SELECT ST_Extent(geometry) FROM parcels"))
print('Overall extent:', result.scalar())

# Test MVT query with a tile that covers India (zoom 4, tile covering India)
# At zoom 4, tile 8, 8 covers roughly India
# Let's try a few tiles
for z in [4, 5, 6]:
    for x in range(2**z):
        for y in range(2**z):
            result = db.execute(text(f"""
                SELECT ST_AsMVT(mvt, 'parcels', 4096, 'geom')
                FROM (
                    SELECT
                        id AS parcel_id,
                        canonical_parcel_id,
                        state_code,
                        district_code,
                        ST_AsMVTGeom(
                            geometry,
                            ST_TileEnvelope({z}, {x}, {y}),
                            4096, 64, true
                        ) AS geom
                    FROM parcels
                    WHERE geometry && ST_TileEnvelope({z}, {x}, {y})
                ) AS mvt
            """))
            tile_data = result.scalar()
            if tile_data and len(tile_data) > 10:
                print(f'Tile z={z}, x={x}, y={y}: {len(tile_data)} bytes')
                break
        else:
            continue
        break
    else:
        continue
    break