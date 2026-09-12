import pytest

from app.common.parcel_generation.cluster_generator import CLUSTER_CONFIGS, generate_cluster_parcels


@pytest.mark.parametrize("config", CLUSTER_CONFIGS, ids=lambda c: c.cluster_id)
def test_generates_exactly_parcel_count_valid_parcels(config):
    parcels = generate_cluster_parcels(config)
    assert len(parcels) == config.parcel_count

    for parcel in parcels:
        # Every returned ring is closed (first == last) and a simple polygon.
        assert parcel.ring[0] == parcel.ring[-1]
        assert len(parcel.ring) >= 4  # 3 open vertices + the closing repeat
        assert parcel.area_sq_m > 0


def test_parcels_stay_near_the_cluster_center():
    config = CLUSTER_CONFIGS[0]
    parcels = generate_cluster_parcels(config)
    # Roughly radius_meters in degrees - generous bound, just catches a
    # gross unit-conversion bug (e.g. meters where degrees were expected).
    max_deg_spread = (config.radius_meters / 100_000) * 3
    for parcel in parcels:
        assert abs(parcel.centroid[0] - config.center_lng) < max_deg_spread
        assert abs(parcel.centroid[1] - config.center_lat) < max_deg_spread
