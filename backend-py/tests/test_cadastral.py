import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_cadastral_hierarchy():
    response = client.get("/api/v1/gis/cadastral/hierarchy")
    assert response.status_code == 200
    data = response.json()
    assert data["stateCode"] == "MH"
    assert "districts" in data
    assert len(data["districts"]) > 0

    # Verify first district has talukas and villages with bboxes
    district = data["districts"][0]
    assert "districtName" in district
    assert "talukas" in district
    assert len(district["talukas"]) > 0
    village = district["talukas"][0]["villages"][0]
    assert "code" in village
    assert "name" in village
    assert "bbox" in village
    assert len(village["bbox"]) == 4


def test_cadastral_village_geojson():
    # First get a valid village code from hierarchy
    hier_resp = client.get("/api/v1/gis/cadastral/hierarchy")
    assert hier_resp.status_code == 200
    hier = hier_resp.json()
    sample_village = hier["districts"][0]["talukas"][0]["villages"][0]
    v_code = sample_village["code"]

    response = client.get(f"/api/v1/gis/cadastral/village/{v_code}")
    assert response.status_code == 200
    fc = response.json()
    assert fc["type"] == "FeatureCollection"
    assert "features" in fc
    assert len(fc["features"]) > 0

    # Verify anti-scraping sanitization: no raw info text in features
    first_feature = fc["features"][0]
    assert "properties" in first_feature
    assert "plotno" in first_feature["properties"]
    assert "area" in first_feature["properties"]
    assert "info" not in first_feature["properties"]
    assert "geometry" in first_feature


def test_cadastral_plot_details():
    # First get a village and extract a plot ID
    hier_resp = client.get("/api/v1/gis/cadastral/hierarchy")
    sample_village = hier_resp.json()["districts"][0]["talukas"][0]["villages"][0]
    v_code = sample_village["code"]

    village_resp = client.get(f"/api/v1/gis/cadastral/village/{v_code}")
    fc = village_resp.json()
    first_plot_id = fc["features"][0]["properties"]["id"]

    # Hydrate details on demand
    detail_resp = client.get(f"/api/v1/gis/cadastral/plot/{first_plot_id}/details")
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["plotid"] == first_plot_id
    assert "parsedInfo" in detail
    assert "rawInfo" in detail
    assert "villageName" in detail


def test_cadastral_search():
    response = client.get("/api/v1/gis/cadastral/search?query=10&limit=5")
    assert response.status_code == 200
    data = response.json()
    assert "results" in data
    assert len(data["results"]) > 0
    assert data["results"][0]["plotno"] == "10"
