from app.database import get_db
from sqlalchemy import text

db = next(get_db())
# Check the overall extent of parcels with explicit SRID
result = db.execute(text("SELECT ST_SetSRID(ST_Extent(geometry), 4326) FROM parcels"))
extent = result.scalar()
print('Parcel extent:', extent)

# Check what tile covers the parcel extent at zoom 5 using the correct approach
# First, transform the extent to 3857
result = db.execute(text("SELECT ST_AsText(ST_Transform(ST_SetSRID(ST_Extent(geometry), 4326), 3857)) FROM parcels"))
print('Parcel extent in 3857:', result.scalar())

# Check what tile covers the parcel extent at zoom 5
for z in [4, 5, 6, 7]:
    for x in range(2**z):
        for y in range(2**z):
            result = db.execute(text(f"""
                SELECT COUNT(*) FROM parcels 
                WHERE geometry && ST_Transform(ST_TileEnvelope({z}, {x}, {y}), 4326)
            """))
            count = result.scalar()
            if count > 0:
                print(f'Tile z={z}, x={x}, y={y}: {count} parcels')
                break
        else:
            continue
        break
    else:
        continue
    break