from app.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    db.execute(text("UPDATE alembic_version SET version_num = '4bc2bd5e393d'"))
    db.commit()
    print("Updated alembic_version to 4bc2bd5e393d")
    result = db.execute(text("SELECT version_num FROM alembic_version")).fetchall()
    print("New version:", result)
finally:
    db.close()