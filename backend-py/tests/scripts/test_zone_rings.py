"""Shared-edge invariant for seed's stacked zoning rings (Part E).

build_stacked_zone_rings must make adjacent zones share a coordinate-identical
edge - no overlap, no sliver - so seeded data satisfies the invariant that
spatial_service.snap_zone_to_shared_edges enforces on write.
"""

from scripts.seed import Bounds, build_stacked_zone_rings


def test_adjacent_zones_share_exact_edge():
    bounds = Bounds(min_lng=73.0, min_lat=18.0, max_lng=74.0, max_lat=19.0)
    rings = build_stacked_zone_rings(bounds, [0, 0.5, 0.7, 1])
    assert len(rings) == 3

    # Ring layout: [(min_lng,lo),(max_lng,lo),(max_lng,hi),(min_lng,hi),(min_lng,lo)]
    for lower, upper in zip(rings, rings[1:]):
        lower_top = lower[2][1]      # hi of the lower zone
        upper_bottom = upper[0][1]   # lo of the upper zone
        assert lower_top == upper_bottom, "adjacent zones must share the exact boundary latitude"
        # same lng extent on both sides of the shared edge => identical segment
        assert lower[2][0] == upper[1][0]  # max_lng
        assert lower[3][0] == upper[0][0]  # min_lng
        # not overlapping: upper starts exactly where lower ends, not below it
        assert upper_bottom >= lower[0][1]

    # each ring is closed
    for ring in rings:
        assert ring[0] == ring[-1]
