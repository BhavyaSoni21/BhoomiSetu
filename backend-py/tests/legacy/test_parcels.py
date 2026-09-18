from app.database import get_db
from sqlalchemy import text

db = next(get_db())
# Check parcel geometries
result = db.execute(text("SELECT id, canonical_parcel_id, ST_AsText(geometry) FROM parcels LIMIT 5"))
for row in result:
    print(row)

# Check if geometries are valid
result = db.execute(text("SELECT COUNT(*) FROM parcels WHERE geometry IS NOT NULL"))
print('Non-null geometries:', result.scalar())

result = db.execute(text("SELECT COUNT(*) FROM parcels WHERE ST_IsValid(geometry)"))
print('Valid geometries:', result.scalar())