from sqlalchemy import text
from app.database import SessionLocal
db = SessionLocal()
engine = db.get_bind()
with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
    conn.execute(text("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid <> pg_backend_pid() AND datname = current_database();"))
