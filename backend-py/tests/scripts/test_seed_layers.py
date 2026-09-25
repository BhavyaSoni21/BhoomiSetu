"""Check every cluster gets the full spatial layer set (seed.py change).

build_cluster_spatial_layers is the one piece of real logic the "layers for
every cluster" change introduced; this pins that it emits all four layer
types anchored to the cluster's own parcels, and that an empty cluster
degrades to nothing rather than crashing.
"""

from types import SimpleNamespace

from scripts.seed import ClusterParcelEntry, build_cluster_spatial_layers


def _grid_entries(n_side: int = 5):
    """A small square grid of unit parcels around (73.85, 18.52)."""
    entries = []
    for i in range(n_side):
        for j in range(n_side):
            lng = 73.85 + i * 0.001
            lat = 18.52 + j * 0.001
            ring = [(lng, lat), (lng + 0.001, lat), (lng + 0.001, lat + 0.001), (lng, lat + 0.001), (lng, lat)]
            centroid = (lng + 0.0005, lat + 0.0005)
            parcel = SimpleNamespace(id=f"p-{i}-{j}")
            entries.append(ClusterParcelEntry(parcel=parcel, ring=ring, centroid=centroid))
    return entries


def test_full_layer_set_per_cluster():
    config = SimpleNamespace(cluster_id="XX-TEST-01", state_code="XX", district="Testville", center_lat=18.52, center_lng=73.85)
    layers = build_cluster_spatial_layers(config, _grid_entries())

    kinds = [type(o).__name__ for o in layers]
    assert kinds.count("ZoningOverlay") == 3, kinds
    assert kinds.count("RestrictionZone") == 1, kinds
    assert kinds.count("InfrastructureFeature") == 4, kinds
    assert kinds.count("ChangeDetectionEvent") == 1, kinds

    # every layer is tagged to this cluster's state/district
    assert all(getattr(o, "district") == "Testville" for o in layers)
    assert all(getattr(o, "state_code") == "XX" for o in layers)


def test_empty_cluster_yields_no_layers():
    config = SimpleNamespace(cluster_id="XX-EMPTY-01", state_code="XX", district="Empty", center_lat=18.52, center_lng=73.85)
    assert build_cluster_spatial_layers(config, []) == []


if __name__ == "__main__":
    test_full_layer_set_per_cluster()
    test_empty_cluster_yields_no_layers()
    print("ok")
