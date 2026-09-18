from app.database import get_db
from sqlalchemy import text

db = next(get_db())
# Find which tile covers India at different zoom levels
# India is roughly 68-98 longitude, 6-38 latitude

# Check the overall extent of parcels in 3857
result = db.execute(text("SELECT ST_AsText(ST_Transform(ST_Extent(geometry), 3857)) FROM parcels"))
print('Parcel extent in 3857:', result.scalar())

# Check what tile covers the parcel extent at zoom 5
# We can use ST_Transform and ST_TileEnvelope to find the right tiles
for z in [4, 5, 6, 7]:
    for x in range(2**z):
        for y in range(2**z):
            result = db.execute(text(f"""
                SELECT COUNT(*) FROM parcels 
                WHERE ST_Transform(geometry, 3857) && ST_TileEnvelope({z}, {x}, {y})
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