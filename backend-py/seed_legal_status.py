"""Seed legal_status_severity for all existing parcels.
Run once after the migration to populate existing rows.
"""
from app.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    # Verify column exists
    result = db.execute(text(
        "SELECT column_name, data_type FROM information_schema.columns "
        "WHERE table_name='parcels' AND column_name='legal_status_severity'"
    )).fetchall()
    print("Column check:", result)

    total = db.execute(text("SELECT COUNT(*) FROM parcels")).scalar()
    print(f"Total parcels: {total}")

    # Inline recompute using the same severity logic as the Celery task
    db.execute(text("""
        UPDATE parcels p
        SET legal_status_severity = CASE
            WHEN EXISTS (
                SELECT 1 FROM dispute_records dr
                WHERE dr.parcel_id = p.id::text
                  AND dr.has_active_dispute = TRUE
                  AND (dr.case_status IS NULL OR dr.case_status NOT IN ('RESOLVED', 'DISMISSED'))
                  AND dr.dispute_type IN ('OWNERSHIP', 'ENCROACHMENT')
            ) THEN 3
            WHEN EXISTS (
                SELECT 1 FROM dispute_records dr
                WHERE dr.parcel_id = p.id::text
                  AND dr.has_active_dispute = TRUE
                  AND (dr.case_status IS NULL OR dr.case_status NOT IN ('RESOLVED', 'DISMISSED'))
            ) THEN 2
            WHEN EXISTS (
                SELECT 1 FROM encumbrance_records er
                WHERE er.parcel_id = p.id::text
                  AND er.has_encumbrance = TRUE
                  AND er.discharge_date IS NULL
            ) THEN 1
            ELSE 0
        END
    """))
    db.commit()

    # Show distribution
    dist = db.execute(text(
        "SELECT legal_status_severity, COUNT(*) AS cnt "
        "FROM parcels GROUP BY legal_status_severity ORDER BY legal_status_severity"
    )).fetchall()
    labels = {0: "Clear", 1: "Encumbered", 2: "Disputed (Low)", 3: "Disputed (High)"}
    print("Severity distribution:")
    for row in dist:
        print(f"  {row.legal_status_severity} ({labels.get(row.legal_status_severity, '?')}): {row.cnt} parcels")
finally:
    db.close()
