from app.database import get_db
from sqlalchemy import text

db = next(get_db())
# Debug: check the transformed tile envelope
result = db.execute(text("SELECT ST_AsText(ST_Transform(ST_TileEnvelope(4, 8, 7), 4326))"))
print('Transformed tile envelope:', result.scalar())

# Check if parcels intersect with it
result = db.execute(text("""
    SELECT COUNT(*) FROM parcels 
    WHERE geometry && ST_Transform(ST_TileEnvelope(4, 8, 7), 4326)
"""))
print('Intersecting parcels:', result.scalar())

# Also check the original bounds
result = db.execute(text("SELECT ST_AsText(ST_TileEnvelope(4, 8, 7))"))
print('Original tile envelope:', result.scalar())

# Try with ST_Transform of geometry
result = db.execute(text("""
    SELECT COUNT(*) FROM parcels 
    WHERE ST_Transform(geometry, 3857) && ST_TileEnvelope(4, 8, 7)
"""))
print('Intersecting with transformed geometry:', result.scalar())