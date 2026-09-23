"""One-shot seed script: populate value_band for all existing parcels.

Run once after the alembic migration `b1c2d3e4f5a6_add_value_band.py`:

    cd backend-py
    python seed_value_band.py

This issues the same idempotent bulk UPDATE that the nightly Celery sweep
uses, so it's safe to run multiple times. After it completes, tile
requests will immediately return the correct `value_band` attribute.
"""
import sys
import os

# Allow running from the backend-py directory without installing the package.
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import text

from app.database import SessionLocal


BULK_UPDATE_SQL = text("""
    UPDATE parcels p
    SET value_band = CASE
        WHEN latest.rate IS NULL OR latest.rate <= 0 THEN 0
        WHEN latest.rate <  500  THEN 1
        WHEN latest.rate < 1200  THEN 2
        WHEN latest.rate < 2000  THEN 3
        WHEN latest.rate < 3000  THEN 4
        ELSE 5
    END
    FROM (
        SELECT DISTINCT ON (t.parcel_id)
               t.parcel_id,
               t.market_value_reference::float / NULLIF(p2.area_sq_m::float, 0) AS rate
        FROM   tax_records t
        JOIN   parcels p2 ON p2.id::text = t.parcel_id
        WHERE  t.market_value_reference IS NOT NULL
        ORDER  BY t.parcel_id, t.id DESC
    ) AS latest
    WHERE p.id::text = latest.parcel_id
""")

# Also zero-out parcels with no tax record so the column is consistent.
ZERO_UNMATCHED_SQL = text("""
    UPDATE parcels
    SET    value_band = 0
    WHERE  id::text NOT IN (
        SELECT DISTINCT parcel_id FROM tax_records
        WHERE  market_value_reference IS NOT NULL
    )
    AND    value_band <> 0
""")


def main():
    db = SessionLocal()
    try:
        print("Populating value_band for parcels with tax data...")
        result = db.execute(BULK_UPDATE_SQL)
        updated = result.rowcount
        print(f"  -> Updated {updated} parcels")

        print("Zeroing value_band for parcels without tax data...")
        result2 = db.execute(ZERO_UNMATCHED_SQL)
        zeroed = result2.rowcount
        print(f"  -> Zeroed {zeroed} parcels")

        db.commit()
        print("Done. Total affected:", updated + zeroed)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
