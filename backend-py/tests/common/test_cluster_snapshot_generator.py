from app.common.parcel_generation.cluster_snapshot_generator import (
    compute_cluster_bounds,
    render_cluster_snapshot,
)

SQUARE_RING = [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0), (0.0, 0.0)]


def test_compute_cluster_bounds_pads_around_a_single_ring():
    bounds = compute_cluster_bounds([SQUARE_RING])
    assert bounds.min_lng < 0.0
    assert bounds.min_lat < 0.0
    assert bounds.max_lng > 1.0
    assert bounds.max_lat > 1.0


def test_render_cluster_snapshot_produces_a_valid_png():
    bounds = compute_cluster_bounds([SQUARE_RING])
    png_bytes = render_cluster_snapshot([SQUARE_RING], bounds, ["NONE"])
    assert png_bytes[:8] == b"\x89PNG\r\n\x1a\n"


def test_render_cluster_snapshot_mismatched_lengths_raises():
    bounds = compute_cluster_bounds([SQUARE_RING])
    try:
        render_cluster_snapshot([SQUARE_RING, SQUARE_RING], bounds, ["NONE"])
        assert False, "expected a length-mismatch error"
    except ValueError:
        pass
