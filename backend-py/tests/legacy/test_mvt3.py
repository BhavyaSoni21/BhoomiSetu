from app.database import get_db
from sqlalchemy import text

db = next(get_db())
# The overall extent is roughly 72-94, 8-31
# At zoom 5, tile envelope
result = db.execute(text("SELECT ST_AsText(ST_TileEnvelope(5, 14, 10))"))
print('Tile 5/14/10:', result.scalar())

result = db.execute(text("SELECT ST_AsText(ST_TileEnvelope(5, 15, 10))"))
print('Tile 5/15/10:', result.scalar())

result = db.execute(text("SELECT ST_AsText(ST_TileEnvelope(6, 29, 20))"))
print('Tile 6/29/20:', result.scalar())

result = db.execute(text("SELECT ST_AsText(ST_TileEnvelope(6, 30, 20))"))
print('Tile 6/30/20:', result.scalar())

# Let's find a tile that intersects
for z in [4, 5, 6]:
    for x in range(2**z):
        for y in range(2**z):
            result = db.execute(text(f"""
                SELECT COUNT(*) FROM parcels WHERE geometry && ST_TileEnvelope({z}, {x}, {y})
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