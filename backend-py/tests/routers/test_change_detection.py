"""Ported from backend/test/change-detection.e2e-spec.ts."""

import io

from geoalchemy2.shape import from_shape
from PIL import Image
from shapely.geometry import Polygon

from app.models.governance import GovernanceAlert
from app.models.parcel import Parcel
from app.models.spatial import ChangeDetectionEvent
from tests.helpers.auth import create_authenticated_user

IMAGE_SIZE = 200


def make_image(fill_color: tuple[int, int, int], rect: dict | None = None) -> bytes:
    """A solid background, optionally with a colored rectangle painted
    into it, encoded as a real PNG - so these tests exercise the actual
    decode/resize/diff pipeline against real image bytes, not a mocked
    stand-in.
    """
    img = Image.new("RGBA", (IMAGE_SIZE, IMAGE_SIZE), (*fill_color, 255))
    if rect:
        pixels = img.load()
        for row in range(rect["min_row"], rect["max_row"] + 1):
            for col in range(rect["min_col"], rect["max_col"] + 1):
                pixels[col, row] = (*rect["color"], 255)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def square(min_lng: float, min_lat: float, size: float = 0.001):
    return from_shape(
        Polygon([(min_lng, min_lat), (min_lng + size, min_lat), (min_lng + size, min_lat + size), (min_lng, min_lat + size), (min_lng, min_lat)]),
        srid=4326,
    )


# Image bounds cover exactly this box, so a parcel placed inside it should
# be flagged, and a parcel placed well outside it should not be.
IMAGE_BOUNDS = {"minLng": "73.849", "minLat": "18.519", "maxLng": "73.852", "maxLat": "18.522"}
# A 40x40 painted block centered on pixel (100,100), which is where a
# parcel centered in IMAGE_BOUNDS maps to at a 200x200 analysis grid.
CHANGED_RECT = {"min_row": 80, "max_row": 120, "min_col": 80, "max_col": 120, "color": (200, 0, 0)}


def _seed_parcels(db):
    # Centroid at (73.8505, 18.5205) - the exact center of IMAGE_BOUNDS,
    # which maps to pixel (100,100), inside CHANGED_RECT's painted block.
    near = Parcel(canonical_parcel_id="CD-NEAR", state_code="MH", district_code="PUN", local_body_code="MHLB001", area_sq_m=100, geometry=square(73.8502, 18.5202, 0.0006))
    # Nowhere near IMAGE_BOUNDS.
    far = Parcel(canonical_parcel_id="CD-FAR", state_code="MH", district_code="PUN", local_body_code="MHLB001", area_sq_m=100, geometry=square(73.95, 18.60, 0.001))
    db.add_all([near, far])
    db.flush()
    return near, far


class TestAnalyze:
    def test_detects_a_real_change_and_creates_a_governance_alert_only_for_the_affected_parcel(self, db, client):
        near, far = _seed_parcels(db)
        _, _, headers = create_authenticated_user(db, "LAND_RECORD_OFFICER")
        green = make_image((0, 150, 0))
        changed = make_image((0, 150, 0), CHANGED_RECT)

        res = client.post(
            "/api/v1/change-detection/analyze", headers=headers,
            data={**IMAGE_BOUNDS, "description": "Test change"},
            files={"before": ("before.png", green, "image/png"), "after": ("after.png", changed, "image/png")},
        )
        assert res.status_code == 201
        body = res.json()
        assert body["changeDetected"] is True
        assert body["changedPixelRatio"] > 0
        assert body["changeRegion"]["type"] == "Polygon"
        assert body["affectedParcelIds"] == [str(near.id)]
        assert str(far.id) not in body["affectedParcelIds"]
        assert body["alertsCreated"] == 1
        assert body["eventId"]

        alerts = db.query(GovernanceAlert).filter_by(parcel_id=str(near.id)).all()
        assert len(alerts) == 1
        assert alerts[0].alert_type == "UNAUTHORIZED_CHANGE_DETECTED"
        assert alerts[0].source == "CHANGE_DETECTION"
        assert alerts[0].status == "OPEN"

        event = db.get(ChangeDetectionEvent, body["eventId"])
        assert event.description == "Test change"
        assert event.affected_parcel_ids == [str(near.id)]

    def test_reports_no_change_and_creates_nothing_when_before_after_are_identical(self, db, client):
        _seed_parcels(db)
        _, _, headers = create_authenticated_user(db, "LAND_RECORD_OFFICER")
        green = make_image((0, 150, 0))

        res = client.post(
            "/api/v1/change-detection/analyze", headers=headers,
            data=IMAGE_BOUNDS,
            files={"before": ("before.png", green, "image/png"), "after": ("after.png", green, "image/png")},
        )
        assert res.status_code == 201
        body = res.json()
        assert body["changeDetected"] is False
        assert body["changeRegion"] is None
        assert body["affectedParcelIds"] == []
        assert body["alertsCreated"] == 0

    def test_rejects_a_request_missing_the_after_image_with_400(self, db, client):
        _, _, headers = create_authenticated_user(db, "LAND_RECORD_OFFICER")
        green = make_image((0, 150, 0))
        res = client.post(
            "/api/v1/change-detection/analyze", headers=headers,
            data=IMAGE_BOUNDS,
            files={"before": ("before.png", green, "image/png")},
        )
        assert res.status_code == 400

    def test_rejects_a_non_image_file_with_400(self, db, client):
        _, _, headers = create_authenticated_user(db, "LAND_RECORD_OFFICER")
        changed = make_image((0, 150, 0), CHANGED_RECT)
        res = client.post(
            "/api/v1/change-detection/analyze", headers=headers,
            data=IMAGE_BOUNDS,
            files={"before": ("before.txt", b"not an image", "text/plain"), "after": ("after.png", changed, "image/png")},
        )
        assert res.status_code == 400

    def test_rejects_out_of_range_coordinates_with_400(self, db, client):
        _, _, headers = create_authenticated_user(db, "LAND_RECORD_OFFICER")
        green = make_image((0, 150, 0))
        changed = make_image((0, 150, 0), CHANGED_RECT)
        res = client.post(
            "/api/v1/change-detection/analyze", headers=headers,
            data={"minLng": "999", "minLat": "18.519", "maxLng": "73.852", "maxLat": "18.522"},
            files={"before": ("before.png", green, "image/png"), "after": ("after.png", changed, "image/png")},
        )
        assert res.status_code == 400

    def test_rejects_an_unauthenticated_request_with_401(self, db, client):
        green = make_image((0, 150, 0))
        changed = make_image((0, 150, 0), CHANGED_RECT)
        res = client.post(
            "/api/v1/change-detection/analyze",
            data=IMAGE_BOUNDS,
            files={"before": ("before.png", green, "image/png"), "after": ("after.png", changed, "image/png")},
        )
        assert res.status_code == 401
