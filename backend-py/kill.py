from sqlalchemy import create_engine, text
from app.config import settings
engine = create_engine(settings.database_url, isolation_level="AUTOCOMMIT")
with engine.connect() as conn:
    conn.execute(text("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid <> pg_backend_pid() AND datname = current_database();"))
