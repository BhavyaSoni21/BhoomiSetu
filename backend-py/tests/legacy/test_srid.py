from app.database import get_db
from sqlalchemy import text

db = next(get_db())
# Check SRID of geometry column
result = db.execute(text("SELECT ST_SRID(geometry) FROM parcels LIMIT 5"))
for row in result:
    print('SRID:', row[0])

# Check the column definition
result = db.execute(text("""
    SELECT column_name, udt_name, 
           (SELECT srid FROM geometry_columns WHERE f_table_name = 'parcels' AND f_geometry_column = 'geometry') as srid
    FROM information_schema.columns 
    WHERE table_name = 'parcels' AND column_name = 'geometry'
"""))
for row in result:
    print('Column info:', row)