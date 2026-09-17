import math

import pytest

from app.common.parcel_generation.geometry import (
    RingValidationOptions,
    convex_hull,
    convex_polygon_min_width,
    dedupe_ring,
    local_area,
    local_bounds,
    local_centroid,
    nibble_corner,
    split_convex_polygon,
    split_convex_polygon_with_gap,
    validate_local_ring,
)

SQUARE = [(0.0, 0.0), (10.0, 0.0), (10.0, 10.0), (0.0, 10.0)]


def test_local_area_of_a_10x10_square():
    assert local_area(SQUARE) == pytest.approx(100.0)


def test_local_centroid_of_a_square():
    assert local_centroid(SQUARE) == pytest.approx((5.0, 5.0))


def test_local_bounds_of_a_square():
    bounds = local_bounds(SQUARE)
    assert (bounds.min_x, bounds.min_y, bounds.max_x, bounds.max_y) == (0, 0, 10, 10)


def test_convex_polygon_min_width_of_a_square_is_its_side():
    assert convex_polygon_min_width(SQUARE) == pytest.approx(10.0)


def test_dedupe_ring_collapses_near_duplicates():
    ring = [(0.0, 0.0), (0.001, 0.001), (10.0, 0.0), (10.0, 10.0), (0.0, 10.0)]
    deduped = dedupe_ring(ring)
    assert len(deduped) == 4


def test_convex_hull_of_a_square_plus_an_interior_point():
    points = [(0.0, 0.0), (10.0, 0.0), (10.0, 10.0), (0.0, 10.0), (5.0, 5.0)]
    hull = convex_hull(points)
    assert len(hull) == 4
    assert (5.0, 5.0) not in hull


def test_split_convex_polygon_splits_a_square_in_half():
    # Vertical line through x=5, direction pointing "north" (0,1) so the
    # right half (side() >= 0) is "inside".
    result = split_convex_polygon(SQUARE, (5.0, 0.0), (0.0, 1.0))
    assert result is not None
    inside, outside = result
    assert local_area(inside) == pytest.approx(50.0)
    assert local_area(outside) == pytest.approx(50.0)


def test_split_convex_polygon_with_gap_leaves_a_real_gap():
    result = split_convex_polygon_with_gap(SQUARE, (5.0, 0.0), (0.0, 1.0), gap_meters=1.0)
    assert result is not None
    inside, outside = result
    # A 1m gap eats into the "inside" half, so it's smaller than a clean 50/50 split.
    assert local_area(inside) < 50.0
    assert local_area(outside) == pytest.approx(50.0)


def test_nibble_corner_turns_a_square_into_a_pentagon():
    nibbled = nibble_corner(SQUARE, 0, 0.2)
    assert len(nibbled) == 5
    assert local_area(nibbled) < local_area(SQUARE)


def test_validate_local_ring_accepts_a_reasonable_square():
    options = RingValidationOptions(min_area_sq_m=50, max_area_sq_m=200, min_width_meters=5)
    assert validate_local_ring(SQUARE, options) is None


def test_validate_local_ring_rejects_too_few_vertices():
    options = RingValidationOptions(min_area_sq_m=1, max_area_sq_m=1000, min_width_meters=1)
    assert validate_local_ring([(0.0, 0.0), (1.0, 1.0)], options) is not None


def test_validate_local_ring_rejects_a_sliver():
    sliver = [(0.0, 0.0), (100.0, 0.0), (100.0, 0.1), (0.0, 0.1)]
    options = RingValidationOptions(min_area_sq_m=1, max_area_sq_m=1000, min_width_meters=5)
    problem = validate_local_ring(sliver, options)
    assert problem is not None
    assert "sliver" in problem


def test_validate_local_ring_rejects_self_intersection():
    bowtie = [(0.0, 0.0), (10.0, 10.0), (10.0, 0.0), (0.0, 10.0)]
    options = RingValidationOptions(min_area_sq_m=1, max_area_sq_m=1000, min_width_meters=1)
    problem = validate_local_ring(bowtie, options)
    assert problem is not None
    assert "self-intersecting" in problem
