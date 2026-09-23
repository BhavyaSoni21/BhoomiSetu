"""One-shot seed script: calculate and store risk_score for all existing parcels.

Run once after alembic migration `c2d3e4f5a6b7_add_risk_score.py`:

    cd backend-py
    python seed_risk_score.py

This uses the same scoring heuristic as predictive_analytics_service.py:
  - Tax Delinquency: 0.4
  - Dispute Exposure: 0.3
  - Open Governance Alerts: 0.2
  - Standing Land-Use Restriction: 0.1
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import bindparam as sa_bindparam, select, update
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.department_record import DisputeRecord, RestrictionRecord, TaxRecord
from app.models.governance import GovernanceAlert
from app.models.parcel import Parcel
from app.services.predictive_analytics_service import _build_result


def main():
    db: Session = SessionLocal()
    try:
        print("Loading parcels and related records...")
        parcels = list(db.scalars(select(Parcel)).all())
        tax_records = list(db.scalars(select(TaxRecord)).all())
        dispute_records = list(db.scalars(select(DisputeRecord)).all())
        restriction_records = list(db.scalars(select(RestrictionRecord)).all())
        open_alerts = list(db.scalars(select(GovernanceAlert).where(GovernanceAlert.status == "OPEN")).all())

        print(f"Loaded {len(parcels)} parcels, {len(tax_records)} taxes, {len(dispute_records)} disputes, {len(restriction_records)} restrictions, {len(open_alerts)} alerts.")

        tax_by_parcel = {r.parcel_id: r for r in tax_records}
        dispute_by_parcel = {r.parcel_id: r for r in dispute_records}
        restriction_by_parcel = {r.parcel_id: r for r in restriction_records}
        alerts_by_parcel = {}
        for alert in open_alerts:
            alerts_by_parcel.setdefault(alert.parcel_id, []).append(alert)

        updates = []
        band_counts = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}
        for parcel in parcels:
            pid = str(parcel.id)
            scored = _build_result(
                pid,
                tax_by_parcel.get(pid),
                dispute_by_parcel.get(pid),
                restriction_by_parcel.get(pid),
                alerts_by_parcel.get(pid, []),
            )
            updates.append({"b_id": parcel.id, "b_score": float(scored.overall_score)})
            band_counts[scored.risk_band] = band_counts.get(scored.risk_band, 0) + 1

        print("Updating risk_score in parcels table...")
        chunk_size = 1000
        for i in range(0, len(updates), chunk_size):
            chunk = updates[i:i + chunk_size]
            db.execute(
                update(Parcel)
                .where(Parcel.id == sa_bindparam("b_id"))
                .values(risk_score=sa_bindparam("b_score")),
                chunk,
            )
        db.commit()

        print(f"Successfully updated {len(updates)} parcels.")
        print(f"Risk band distribution: {band_counts}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
