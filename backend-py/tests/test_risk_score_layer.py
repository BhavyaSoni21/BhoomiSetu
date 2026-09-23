"""Unit tests for Composite Risk Score layer and task helpers (NEW_MAP_LAYERS_PLAN.md Layer 4)."""
import pytest

from app.models.department_record import DisputeRecord, RestrictionRecord, TaxRecord
from app.models.governance import GovernanceAlert
from app.services.predictive_analytics_service import (
    _band_for,
    _build_result,
    _clamp,
)


class TestRiskScoreLogic:
    def test_band_for_thresholds(self):
        assert _band_for(0) == "LOW"
        assert _band_for(24.9) == "LOW"
        assert _band_for(25) == "MEDIUM"
        assert _band_for(49.9) == "MEDIUM"
        assert _band_for(50) == "HIGH"
        assert _band_for(74.9) == "HIGH"
        assert _band_for(75) == "CRITICAL"
        assert _band_for(100) == "CRITICAL"

    def test_clamp_helper(self):
        assert _clamp(-10, 0, 100) == 0
        assert _clamp(50, 0, 100) == 50
        assert _clamp(150, 0, 100) == 100

    def test_build_result_all_clean(self):
        result = _build_result(
            parcel_id="test-p1",
            tax=None,
            dispute=None,
            restriction=None,
            open_alerts=[],
        )
        assert result.parcel_id == "test-p1"
        assert result.overall_score == 0
        assert result.risk_band == "LOW"
        assert len(result.factors) == 4

    def test_build_result_with_high_risk_dispute(self):
        dispute = DisputeRecord(
            parcel_id="test-p2",
            has_active_dispute=True,
            dispute_type="OWNERSHIP",
            case_status="PENDING_HEARING",
        )
        result = _build_result(
            parcel_id="test-p2",
            tax=None,
            dispute=dispute,
            restriction=None,
            open_alerts=[],
        )
        assert result.overall_score > 0
        assert result.risk_band in ("MEDIUM", "HIGH", "CRITICAL")
