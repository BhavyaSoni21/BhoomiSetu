"""Unit tests for value_band Celery task helpers (NEW_MAP_LAYERS_PLAN.md Layer 3).

These tests target the pure `_compute_value_band` function only — no DB,
no Celery worker needed. They cover all 6 band values (0–5) plus edge cases.
"""
import pytest

from app.tasks.value_band_tasks import _compute_value_band


class TestComputeValueBand:
    """Band cutoffs:
    0 = None / ≤ 0  (no data)
    1 = < 500
    2 = 500 – 1199
    3 = 1200 – 1999
    4 = 2000 – 2999
    5 = ≥ 3000
    """

    def test_none_returns_band_0(self):
        assert _compute_value_band(None) == 0

    def test_zero_returns_band_0(self):
        assert _compute_value_band(0.0) == 0

    def test_negative_returns_band_0(self):
        assert _compute_value_band(-100.0) == 0

    # Band 1: < 500
    def test_low_value_returns_band_1(self):
        assert _compute_value_band(264.0) == 1  # seeded dataset minimum

    def test_just_below_500_returns_band_1(self):
        assert _compute_value_band(499.99) == 1

    # Band 2: 500 – 1199
    def test_exactly_500_returns_band_2(self):
        assert _compute_value_band(500.0) == 2

    def test_mid_band_2(self):
        assert _compute_value_band(800.0) == 2

    def test_just_below_1200_returns_band_2(self):
        assert _compute_value_band(1199.99) == 2

    # Band 3: 1200 – 1999
    def test_exactly_1200_returns_band_3(self):
        assert _compute_value_band(1200.0) == 3

    def test_avg_value_returns_band_3(self):
        assert _compute_value_band(1731.0) == 3  # seeded dataset average

    def test_just_below_2000_returns_band_3(self):
        assert _compute_value_band(1999.99) == 3

    # Band 4: 2000 – 2999
    def test_exactly_2000_returns_band_4(self):
        assert _compute_value_band(2000.0) == 4

    def test_mid_band_4(self):
        assert _compute_value_band(2500.0) == 4

    def test_just_below_3000_returns_band_4(self):
        assert _compute_value_band(2999.99) == 4

    # Band 5: ≥ 3000
    def test_exactly_3000_returns_band_5(self):
        assert _compute_value_band(3000.0) == 5

    def test_max_seeded_value_returns_band_5(self):
        assert _compute_value_band(3744.0) == 5  # seeded dataset maximum

    def test_very_high_value_returns_band_5(self):
        assert _compute_value_band(100_000.0) == 5

    # Type tolerance
    def test_integer_input_works(self):
        # int is coercible to float comparisons
        assert _compute_value_band(1500) == 3  # type: ignore[arg-type]
