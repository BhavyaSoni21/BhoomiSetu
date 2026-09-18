from app.database import get_db
from sqlalchemy import text

db = next(get_db())
# Test MVT query with India bounds
result = db.execute(text("SELECT ST_AsMVTGeom(geometry, ST_MakeEnvelope(68, 6, 98, 38, 4326), 4096, 64, true) FROM parcels LIMIT 1"))
print('MVT test result:', result.fetchone())

# Check if we have any parcels
result = db.execute(text('SELECT COUNT(*) FROM parcels'))
print('Parcel count:', result.scalar())