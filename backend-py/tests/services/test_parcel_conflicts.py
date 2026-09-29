"""Unit checks for the Parcel-360 conflict band + owner-only masking.

Pure-function level (no DB): _detect_conflicts is fed already-fetched record
stand-ins, and mask_restricted_departments is checked to strip conflicts that
draw on a restricted department so masking isn't leaked back via the band.
"""

from types import SimpleNamespace

from app.services import parcel_access
from app.services.response_aggregator_service import _detect_conflicts, _names_conflict


def test_names_conflict_normalization():
    assert _names_conflict("Ramesh Patil", "Ramesh Kumar Patil")  # differing token set
    assert not _names_conflict("Ramesh Patil", "ramesh  patil")   # case/space only
    assert not _names_conflict("Ramesh Patil", None)              # missing side


def test_detect_conflicts_flags_owner_area_tax_dispute():
    land = SimpleNamespace(owner_name="Ramesh Kumar Patil", area_sq_m=920)
    survey = SimpleNamespace(measured_area_sq_m=985)
    tax = SimpleNamespace(tax_status="OVERDUE", outstanding_amount=48500)
    dispute = SimpleNamespace(has_active_dispute=True, dispute_type="BOUNDARY")
    conflicts = _detect_conflicts(
        land_records=land, tax=tax, survey=survey, dispute=dispute,
        encumbrance=None, ownership_owner="Ramesh Patil",
    )
    types = {c["type"] for c in conflicts}
    assert {"OWNER_NAME_MISMATCH", "AREA_MISMATCH", "TAX_OVERDUE", "ACTIVE_DISPUTE"} <= types


def test_mask_strips_restricted_conflicts_only():
    result = {
        "departments": {k: object() for k in
                        ("planning", "tax", "restriction", "dispute", "encumbrance", "land_records", "registration")},
        "conflicts": [
            {"type": "OWNER_NAME_MISMATCH", "sources": ["LAND_RECORDS", "REGISTRATION"]},
            {"type": "AREA_MISMATCH", "sources": ["LAND_RECORDS", "SURVEY"]},
            {"type": "TAX_OVERDUE", "sources": ["TAX"]},
            {"type": "ACTIVE_DISPUTE", "sources": ["DISPUTE"]},
        ],
    }
    parcel_access.mask_restricted_departments(result)
    kept = {c["type"] for c in result["conflicts"]}
    assert kept == {"OWNER_NAME_MISMATCH", "AREA_MISMATCH"}  # TAX/DISPUTE dropped
    for dept in ("planning", "tax", "restriction", "dispute", "encumbrance"):
        assert result["departments"][dept] is None
