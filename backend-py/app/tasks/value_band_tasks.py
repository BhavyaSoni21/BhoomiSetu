"""Celery tasks for the Circle Rate / Guidance Value Heatmap layer
(NEW_MAP_LAYERS_PLAN.md Layer 3).

Two tasks:
  - recompute_value_band: per-parcel, event-driven. Call this whenever a
    TaxRecord is created or updated for a parcel so the tile attribute
    stays near-real-time.
  - recompute_all_value_bands: nightly full-sweep. Idempotent. Uses a
    single SQL UPDATE to avoid per-row Python overhead on large tables.

Band scale (₹/sqm = market_value_reference / area_sq_m):
  0 = no data (parcel has no tax record with market_value_reference set)
  1 = < ₹500/sqm      (very low)
  2 = ₹500–1 199/sqm  (low)
  3 = ₹1 200–1 999/sqm (medium)
  4 = ₹2 000–2 999/sqm (high)
  5 = ≥ ₹3 000/sqm     (very high)

Cutoffs are hardcoded here because all 6 120 seeded parcels fall within
the same order-of-magnitude range (₹264–₹3 744/sqm). For per-state
configurability add a `valuation_bands` config table keyed by state_code
and swap the CASE expression below to join against it.

Cross-cutting rule (§ plan rule 3): band is computed once, stored in a
plain column, never re-derived inside a tile request.
"""
import logging

try:
    from celery import shared_task
except ImportError:
    def shared_task(*args, **kwargs):
        def decorator(fn):
            return fn
        return decorator

from sqlalchemy import text

from app.core.celery_app import celery_app  # noqa: F401 – ensures app is configured
from app.database import SessionLocal

logger = logging.getLogger(__name__)

# Band cutoffs in ₹/sqm. These match the frontend legend in MapComponent.tsx
# and UnifiedMapWrapper.tsx — keep them in sync.
_BAND_CUTOFFS = [
    (500,  1),  # < 500  → band 1
    (1200, 2),  # < 1200 → band 2
    (2000, 3),  # < 2000 → band 3
    (3000, 4),  # < 3000 → band 4
]
_BAND_MAX = 5  # ≥ 3000 → band 5


def _compute_value_band(rate_per_sqm: float | None) -> int:
    """Pure banding function: converts ₹/sqm float → int band 0-5.

    Returns 0 when rate is None (no data) or non-positive (data error).
    """
    if rate_per_sqm is None or rate_per_sqm <= 0:
        return 0
    for cutoff, band in _BAND_CUTOFFS:
        if rate_per_sqm < cutoff:
            return band
    return _BAND_MAX


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def recompute_value_band(self, parcel_id: str) -> dict:
    """Recompute value_band for a single parcel.

    Reads the most-recent TaxRecord for this parcel, computes ₹/sqm,
    maps to the band scale, and writes parcel.value_band. Call this
    from the TaxRecord create/update write path.
    """
    db = SessionLocal()
    try:
        row = db.execute(
            text("""
                SELECT t.market_value_reference, p.area_sq_m
                FROM   tax_records t
                JOIN   parcels     p ON p.id::text = t.parcel_id
                WHERE  t.parcel_id = :parcel_id
                  AND  t.market_value_reference IS NOT NULL
                ORDER  BY t.id DESC
                LIMIT  1
            """),
            {"parcel_id": str(parcel_id)},
        ).fetchone()

        if row is None or row.area_sq_m is None or float(row.area_sq_m) <= 0:
            band = 0
        else:
            rate_per_sqm = float(row.market_value_reference) / float(row.area_sq_m)
            band = _compute_value_band(rate_per_sqm)

        db.execute(
            text("UPDATE parcels SET value_band = :band WHERE id::text = :parcel_id"),
            {"band": band, "parcel_id": str(parcel_id)},
        )
        db.commit()
        logger.info("recompute_value_band(%s) → band %d", parcel_id, band)
        return {"parcel_id": parcel_id, "value_band": band}

    except Exception as exc:
        db.rollback()
        logger.exception("recompute_value_band(%s) failed", parcel_id)
        raise self.retry(exc=exc)
    finally:
        db.close()


@shared_task
def recompute_all_value_bands() -> dict:
    """Nightly full-sweep: recompute value_band for every parcel.

    Uses a single SQL UPDATE with a sub-SELECT to avoid per-row Python
    overhead. Idempotent — safe to run multiple times.
    """
    db = SessionLocal()
    try:
        result = db.execute(text("""
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
        """))
        db.commit()
        updated = result.rowcount
        logger.info("recompute_all_value_bands: updated %d parcels", updated)
        return {"updated": updated}
    except Exception:
        db.rollback()
        logger.exception("recompute_all_value_bands failed")
        raise
    finally:
        db.close()
