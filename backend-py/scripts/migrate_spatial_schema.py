from datetime import datetime

from sqlalchemy import text

from app.database import engine


BACKUP_SCHEMA = "legacy_backup_20260913"

GEOMETRY_COLUMNS = {
    "parcels": "geometry",
    "zoning_overlays": "geometry",
    "restriction_zones": "geometry",
    "infrastructure_features": "geometry",
    "admin_map_notes": "geometry",
    "change_detection_events": "geometry",
}

ARRAY_COLUMNS = {
    "zoning_overlays": "parcelIds",
    "restriction_zones": "affectedParcelIds",
    "change_detection_events": "affectedParcelIds",
}


def qi(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'


with engine.begin() as conn:
    exists = conn.execute(
        text("select exists (select 1 from information_schema.schemata where schema_name=:s)"),
        {"s": BACKUP_SCHEMA},
    ).scalar_one()
    if exists:
        raise RuntimeError(f"Backup schema {BACKUP_SCHEMA!r} already exists; refusing to overwrite it")

    conn.execute(text(f"create schema {qi(BACKUP_SCHEMA)}"))
    tables = conn.execute(
        text("select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE'")
    ).scalars().all()
    for table in tables:
        conn.execute(text(f"create table {qi(BACKUP_SCHEMA)}.{qi(table)} as table public.{qi(table)} with no data"))
        conn.execute(text(f"insert into {qi(BACKUP_SCHEMA)}.{qi(table)} select * from public.{qi(table)}"))

    for table, column in GEOMETRY_COLUMNS.items():
        present = conn.execute(
            text("select exists (select 1 from information_schema.columns where table_schema='public' and table_name=:t and column_name=:c)"),
            {"t": table, "c": column},
        ).scalar_one()
        if not present:
            continue
        tcol = f"public.{qi(table)}.{qi(column)}"
        conn.execute(text(
            f"alter table public.{qi(table)} alter column {qi(column)} type geometry(Geometry,4326) "
            f"using case when {tcol} is null or btrim({tcol})='' then null "
            f"else st_setsrid(st_geomfromewkb(decode(replace({tcol}, '\\\\x', ''), 'hex')), 4326) end"
        ))

    for table, column in ARRAY_COLUMNS.items():
        present = conn.execute(
            text("select exists (select 1 from information_schema.columns where table_schema='public' and table_name=:t and column_name=:c)"),
            {"t": table, "c": column},
        ).scalar_one()
        if not present:
            continue
        col = qi(column)
        conn.execute(text(
            f"alter table public.{qi(table)} alter column {col} type text[] "
            f"using case when {col} is null or btrim({col}) in ('', '{{}}') then '{{}}'::text[] "
            f"else string_to_array(trim(both '{{}}' from {col}), ',') end"
        ))

print(f"Migration complete; backup schema: {BACKUP_SCHEMA}")
