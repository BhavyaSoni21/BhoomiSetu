from collections.abc import Generator

from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings

settings = get_settings()
engine = create_engine(settings.sqlalchemy_database_uri, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
_schema_columns_aligned = False


class Base(DeclarativeBase):
    pass


def align_model_columns_with_database() -> None:
    """Align migrated model names with the existing TypeORM schema.

    The Python models use snake_case attributes, while the existing Supabase
    tables mostly use TypeORM's camelCase column names. Legacy join-table
    foreign keys remain snake_case, so a column is changed only when its
    camelCase counterpart is actually present in the connected database.
    """
    global _schema_columns_aligned
    if _schema_columns_aligned:
        return

    inspector = inspect(engine)
    aliases = {"metadata_json": "metadata"}
    for table in Base.metadata.tables.values():
        if not inspector.has_table(table.name):
            continue
        actual_names = {column["name"] for column in inspector.get_columns(table.name)}
        for column in table.columns:
            if column.name in actual_names:
                continue
            parts = column.name.split("_")
            camel_name = parts[0] + "".join(part.capitalize() for part in parts[1:])
            candidate = aliases.get(column.name, camel_name)
            if candidate in actual_names:
                column.name = candidate
    _schema_columns_aligned = True


def get_db() -> Generator[Session, None, None]:
    """Commits once the route handler returns successfully (every write
    endpoint below calls db.flush(), not db.commit() - flush alone makes
    changes visible/queryable within the request but never durable), and
    rolls back on any exception so a failed request never leaves a partial
    write committed.
    """
    align_model_columns_with_database()
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
