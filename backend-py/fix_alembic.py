from app.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    conn.execute(text("UPDATE alembic_version SET version_num = 'cf01cbb859fb'"))
    conn.commit()
    result = conn.execute(text('SELECT version_num FROM alembic_version'))
    print(result.fetchall())