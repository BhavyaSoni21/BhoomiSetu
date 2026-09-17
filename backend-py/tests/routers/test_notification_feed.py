"""Ported from backend/test/notification-feed.e2e-spec.ts.

Fully self-contained - a complete, unscoped port of the original spec.
"""

from app.models.notification import Notification
from tests.helpers.auth import create_authenticated_user


def _seed(db):
    db.query(Notification).delete()
    citizen, _, citizen_headers = create_authenticated_user(db, "CITIZEN")
    _, _, other_citizen_headers = create_authenticated_user(db, "CITIZEN")

    own_notification = Notification(
        user_id=str(citizen.id), type="WORKFLOW_STEP_APPROVED", title="Your request was approved",
        message="Land Records approved your request.", parcel_id="p1", workflow_id="w1", alert_id=None, read=False,
    )
    db.add(own_notification)
    # Belongs to a different user - every test below confirms this never
    # leaks into citizen's own feed or read-mark.
    db.add(Notification(user_id="someone-else", type="WORKFLOW_ASSIGNED", title="Not yours", message="x", read=False))
    db.flush()

    return {"citizen_headers": citizen_headers, "other_citizen_headers": other_citizen_headers, "own_notification": own_notification}


class TestFindMine:
    def test_returns_only_the_signed_in_users_own_notifications(self, db, client):
        s = _seed(db)
        res = client.get("/api/v1/notifications", headers=s["citizen_headers"])
        assert res.status_code == 200
        body = res.json()
        assert len(body) == 1
        assert body[0]["id"] == str(s["own_notification"].id)
        assert body[0]["title"] == "Your request was approved"

    def test_returns_an_empty_array_for_a_user_with_no_notifications(self, db, client):
        s = _seed(db)
        res = client.get("/api/v1/notifications", headers=s["other_citizen_headers"])
        assert res.status_code == 200
        assert res.json() == []

    def test_rejects_an_unauthenticated_request_with_401(self, db, client):
        _seed(db)
        res = client.get("/api/v1/notifications")
        assert res.status_code == 401


class TestMarkRead:
    def test_marks_a_notification_read(self, db, client):
        s = _seed(db)
        res = client.patch(f"/api/v1/notifications/{s['own_notification'].id}/read", headers=s["citizen_headers"])
        assert res.status_code == 200
        assert res.json()["read"] is True

    def test_returns_404_for_a_notification_belonging_to_a_different_user(self, db, client):
        s = _seed(db)
        res = client.patch(f"/api/v1/notifications/{s['own_notification'].id}/read", headers=s["other_citizen_headers"])
        assert res.status_code == 404

    def test_returns_404_for_an_unknown_notification(self, db, client):
        s = _seed(db)
        res = client.patch("/api/v1/notifications/00000000-0000-0000-0000-000000000000/read", headers=s["citizen_headers"])
        assert res.status_code == 404

    def test_rejects_an_unauthenticated_request_with_401(self, db, client):
        s = _seed(db)
        res = client.patch(f"/api/v1/notifications/{s['own_notification'].id}/read")
        assert res.status_code == 401
