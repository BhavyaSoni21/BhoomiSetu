from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.config import get_settings
from app.database import Base

# A fresh Alembic migration history, not inherited from TypeORM
# (PYTHON_MIGRATION_PLAN.md §2) - backend-py owns its own schema from here.
import app.models  # noqa: F401  (registers every model on Base.metadata)

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

config.set_main_option("sqlalchemy.url", get_settings().sqlalchemy_database_uri)

target_metadata = Base.metadata


# GeoAlchemy2's Geometry columns create the `spatial_ref_sys` table (and a
# couple of others) as a side effect of PostGIS itself, not anything our
# own models declare - without this filter, autogenerate sees that table
# in the database but not in target_metadata and proposes dropping it
# (and, symmetrically, recreating it on downgrade), which would be a
# genuinely destructive migration against PostGIS's own system catalog.
def include_object(object, name, type_, reflected, compare_to):
    if type_ == "table" and name in ("spatial_ref_sys",):
        return False
    return True


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, include_object=include_object)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
