"""Phase 1 backend data & audit correctness checks (B1, B3, B6, B7).

One runnable check per non-trivial change. Runs against the same
transactional PostGIS DB as the rest of the suite (needs `alembic upgrade
head`).
"""

import pytest
from fastapi import HTTPException

from app.models.department_record import RegistrationRecord
from app.services.notification_feed_service import NotificationPayload, notify_users
from app.services.spatial_service import geojson_to_geometry
from tests.helpers.auth import create_authenticated_user


# --- B1: verifier availability / assigned_area surface on the picker -------

def test_verifier_fields_surface(client, db):
    v, _, _ = create_authenticated_user(db, "VERIFIER")
    v.availability = "AVAILABLE"
    v.assigned_area = "North Circle"
    db.flush()
    _, _, headers = create_authenticated_user(db, "ADMIN")

    resp = client.get("/api/v1/cases/verifiers", headers=headers)
    assert resp.status_code == 200
    row = next(r for r in resp.json() if r["id"] == str(v.id))
    assert row["availability"] == "AVAILABLE"
    assert row["assignedArea"] == "North Circle"


# --- B3: registration chain search + pagination + count --------------------

def test_registration_chain_search_and_pagination(client, db):
    for i in range(3):
        db.add(RegistrationRecord(
            parcel_id=f"phase1-chain-{i}",
            registration_status="REGISTERED",
            registration_number=f"REGP1-{i}",
        ))
    db.flush()
    _, _, headers = create_authenticated_user(db, "REGISTRATION_OFFICER")

    # Search narrows to the one matching registration number.
    hit = client.get("/api/v1/registration/chain", params={"q": "REGP1-1"}, headers=headers)
    assert hit.status_code == 200
    body = hit.json()
    assert body["total"] == 1
    assert body["records"][0]["registrationNumber"] == "REGP1-1"

    # Pagination caps the page without hiding the true total.
    page = client.get("/api/v1/registration/chain", params={"q": "phase1-chain", "limit": 2, "offset": 0}, headers=headers)
    pbody = page.json()
    assert pbody["total"] == 3
    assert len(pbody["records"]) == 2


# --- B6: invalid geometry rejected at the shared chokepoint ----------------

def test_invalid_geometry_rejected():
    # Self-intersecting bow-tie polygon — is_valid is False.
    bowtie = {"type": "Polygon", "coordinates": [[[0, 0], [1, 1], [1, 0], [0, 1], [0, 0]]]}
    with pytest.raises(HTTPException) as exc:
        geojson_to_geometry(bowtie)
    assert exc.value.status_code == 400
    assert "Invalid geometry" in exc.value.detail


# --- B7: in-app opt-out suppresses the feed row ----------------------------

def test_notify_users_honors_in_app_optout(db):
    on, _, _ = create_authenticated_user(db, "CITIZEN")
    off, _, _ = create_authenticated_user(db, "CITIZEN")
    off.notify_in_app = False
    db.flush()

    payload = NotificationPayload(type="TEST", title="t", message="m")
    notify_users(db, [str(on.id), str(off.id)], payload)

    from app.models.notification import Notification
    rows = db.query(Notification.user_id).filter(Notification.type == "TEST").all()
    got = {str(r[0]) for r in rows}
    assert str(on.id) in got
    assert str(off.id) not in got


def test_notification_prefs_get_and_patch(client, db):
    _, _, headers = create_authenticated_user(db, "CITIZEN")

    got = client.get("/api/v1/notifications/preferences", headers=headers)
    assert got.status_code == 200
    assert got.json() == {"notifySms": True, "notifyEmail": True, "notifyInApp": True}

    patched = client.patch("/api/v1/notifications/preferences", json={"notifySms": False}, headers=headers)
    assert patched.status_code == 200
    assert patched.json()["notifySms"] is False
    assert patched.json()["notifyInApp"] is True
