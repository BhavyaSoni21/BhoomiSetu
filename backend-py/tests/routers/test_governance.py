"""Ported from backend/test/governance-alerts.e2e-spec.ts.

The original spec sleeps 1.1s between seed inserts to work around
SQLite's second-resolution CURRENT_TIMESTAMP. Postgres has microsecond
resolution, so explicit `created_at` timestamps (spread a second apart)
give the same deterministic "newest first" ordering without the sleep.
"""

from datetime import datetime, timedelta, timezone

from app.models.governance import GovernanceAlert
from app.models.notification import Notification
from tests.helpers.auth import create_authenticated_user


def _seed(db):
    db.query(GovernanceAlert).delete()
    db.query(Notification).delete()
    db.flush()

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    flood_alert = GovernanceAlert(
        parcel_id="11111111-1111-1111-1111-111111111111", alert_type="RESTRICTION_ZONE_OVERLAP", severity="MEDIUM",
        source="RESTRICTION_MONITOR", status="OPEN", explanation="Parcel intersects the flood restriction zone.",
        created_at=now - timedelta(seconds=2),
    )
    change_alert = GovernanceAlert(
        parcel_id="22222222-2222-2222-2222-222222222222", alert_type="UNAUTHORIZED_CHANGE_DETECTED", severity="HIGH",
        source="CHANGE_DETECTION", status="OPEN", explanation="New construction footprint detected.",
        created_at=now - timedelta(seconds=1),
    )
    tax_alert = GovernanceAlert(
        parcel_id="33333333-3333-3333-3333-333333333333", alert_type="TAX_OVERDUE", severity="LOW",
        source="TAX_MONITOR", status="RESOLVED", explanation="Outstanding property tax of 500 is overdue.",
        created_at=now,
    )
    db.add_all([flood_alert, change_alert, tax_alert])
    db.flush()

    _, _, officer_headers = create_authenticated_user(db, "LAND_RECORD_OFFICER")
    restriction_officer, _, _ = create_authenticated_user(db, "RESTRICTION_OFFICER")

    return {
        "flood_alert": flood_alert, "change_alert": change_alert, "tax_alert": tax_alert,
        "officer_headers": officer_headers, "restriction_officer_id": str(restriction_officer.id),
    }


def _fresh_alert(db, parcel_id: str, status: str = "OPEN") -> GovernanceAlert:
    alert = GovernanceAlert(parcel_id=parcel_id, alert_type="RESTRICTION_ZONE_OVERLAP", severity="MEDIUM", source="RESTRICTION_MONITOR", status=status, explanation="Parcel intersects a restriction zone.")
    db.add(alert)
    db.flush()
    return alert


class TestFindAll:
    def test_lists_every_alert_newest_first(self, db, client):
        s = _seed(db)
        res = client.get("/api/v1/governance-alerts", headers=s["officer_headers"])
        assert res.status_code == 200
        body = res.json()
        assert len(body) >= 3
        assert body[0]["id"] == str(s["tax_alert"].id)

    def test_filters_by_status(self, db, client):
        s = _seed(db)
        res = client.get("/api/v1/governance-alerts", params={"status": "OPEN"}, headers=s["officer_headers"])
        ids = [a["id"] for a in res.json()]
        assert str(s["flood_alert"].id) in ids
        assert str(s["change_alert"].id) in ids
        assert str(s["tax_alert"].id) not in ids

    def test_filters_by_status_active_pseudo_status(self, db, client):
        s = _seed(db)
        res = client.get("/api/v1/governance-alerts", params={"status": "ACTIVE"}, headers=s["officer_headers"])
        ids = [a["id"] for a in res.json()]
        assert str(s["flood_alert"].id) in ids
        assert str(s["change_alert"].id) in ids
        assert str(s["tax_alert"].id) not in ids

    def test_filters_by_severity(self, db, client):
        s = _seed(db)
        res = client.get("/api/v1/governance-alerts", params={"severity": "HIGH"}, headers=s["officer_headers"])
        assert [a["id"] for a in res.json()] == [str(s["change_alert"].id)]

    def test_combines_status_and_severity_filters(self, db, client):
        s = _seed(db)
        res = client.get("/api/v1/governance-alerts", params={"status": "OPEN", "severity": "LOW"}, headers=s["officer_headers"])
        assert res.json() == []

    def test_rejects_an_unauthenticated_request_with_401(self, db, client):
        _seed(db)
        res = client.get("/api/v1/governance-alerts")
        assert res.status_code == 401


class TestFindOne:
    def test_returns_a_single_alert(self, db, client):
        s = _seed(db)
        res = client.get(f"/api/v1/governance-alerts/{s['flood_alert'].id}", headers=s["officer_headers"])
        assert res.status_code == 200
        assert res.json()["alertType"] == "RESTRICTION_ZONE_OVERLAP"
        assert "flood" in res.json()["explanation"]

    def test_rejects_a_non_uuid_id_with_400(self, db, client):
        s = _seed(db)
        res = client.get("/api/v1/governance-alerts/not-a-uuid", headers=s["officer_headers"])
        assert res.status_code == 400

    def test_returns_404_for_a_well_formed_but_unknown_uuid(self, db, client):
        s = _seed(db)
        res = client.get("/api/v1/governance-alerts/00000000-0000-0000-0000-000000000000", headers=s["officer_headers"])
        assert res.status_code == 404


class TestUpdateStatusFourStageVerification:
    def test_advances_through_all_4_stages_notifying_only_on_final_resolved(self, db, client):
        s = _seed(db)
        alert = _fresh_alert(db, "44444444-4444-4444-4444-444444444444")

        ack = client.patch(f"/api/v1/governance-alerts/{alert.id}/status", json={"status": "ACKNOWLEDGED", "reason": "Looking into this now."}, headers=s["officer_headers"])
        assert ack.status_code == 200
        assert ack.json()["status"] == "ACKNOWLEDGED"
        assert db.query(Notification).filter(Notification.alert_id == str(alert.id)).count() == 0

        verified = client.patch(f"/api/v1/governance-alerts/{alert.id}/status", json={"status": "FIELD_VERIFIED", "reason": "Confirmed on-site - the restriction is real."}, headers=s["officer_headers"])
        assert verified.status_code == 200
        assert verified.json()["status"] == "FIELD_VERIFIED"
        assert db.query(Notification).filter(Notification.alert_id == str(alert.id)).count() == 0

        resolved = client.patch(f"/api/v1/governance-alerts/{alert.id}/status", json={"status": "RESOLVED", "reason": "Restriction survey team addressed the overlap."}, headers=s["officer_headers"])
        assert resolved.status_code == 200
        assert resolved.json()["status"] == "RESOLVED"
        assert resolved.json()["reason"] == "Restriction survey team addressed the overlap."

        # RESTRICTION_ZONE_OVERLAP derives to the RESTRICTION department -
        # its officer, not the LAND_RECORD_OFFICER who resolved it, gets notified.
        notification = db.query(Notification).filter(
            Notification.user_id == s["restriction_officer_id"], Notification.type == "GOVERNANCE_ALERT_RESOLVED", Notification.alert_id == str(alert.id)
        ).first()
        assert notification is not None
        assert "Restriction survey team addressed the overlap" in notification.message

    def test_lets_dismissed_short_circuit_from_a_non_terminal_stage_and_notifies(self, db, client):
        s = _seed(db)
        alert = _fresh_alert(db, "55555555-5555-5555-5555-555555555555", "ACKNOWLEDGED")

        res = client.patch(f"/api/v1/governance-alerts/{alert.id}/status", json={"status": "DISMISSED", "reason": "Duplicate of an already-resolved alert."}, headers=s["officer_headers"])
        assert res.status_code == 200
        assert res.json()["status"] == "DISMISSED"

        notification = db.query(Notification).filter(
            Notification.user_id == s["restriction_officer_id"], Notification.type == "GOVERNANCE_ALERT_DISMISSED", Notification.alert_id == str(alert.id)
        ).first()
        assert notification is not None

    def test_rejects_skipping_a_stage_open_to_field_verified_with_400(self, db, client):
        s = _seed(db)
        alert = _fresh_alert(db, "66666666-6666-6666-6666-666666666666")
        res = client.patch(f"/api/v1/governance-alerts/{alert.id}/status", json={"status": "FIELD_VERIFIED", "reason": "x"}, headers=s["officer_headers"])
        assert res.status_code == 400
        assert "OPEN" in res.json()["message"]

    def test_rejects_skipping_straight_from_open_to_resolved_with_400(self, db, client):
        s = _seed(db)
        alert = _fresh_alert(db, "77777777-7777-7777-7777-777777777777")
        res = client.patch(f"/api/v1/governance-alerts/{alert.id}/status", json={"status": "RESOLVED", "reason": "x"}, headers=s["officer_headers"])
        assert res.status_code == 400

    def test_rejects_any_further_patch_on_a_terminal_resolved_alert_with_400(self, db, client):
        s = _seed(db)
        alert = _fresh_alert(db, "88888888-8888-8888-8888-888888888888", "RESOLVED")
        res = client.patch(f"/api/v1/governance-alerts/{alert.id}/status", json={"status": "DISMISSED", "reason": "x"}, headers=s["officer_headers"])
        assert res.status_code == 400

    def test_rejects_an_invalid_status_value_with_400(self, db, client):
        s = _seed(db)
        res = client.patch(f"/api/v1/governance-alerts/{s['flood_alert'].id}/status", json={"status": "NOT_A_REAL_STATUS", "reason": "x"}, headers=s["officer_headers"])
        assert res.status_code == 400

    def test_rejects_a_missing_reason_with_400(self, db, client):
        s = _seed(db)
        alert = _fresh_alert(db, "99999999-9999-9999-9999-999999999999")
        res = client.patch(f"/api/v1/governance-alerts/{alert.id}/status", json={"status": "ACKNOWLEDGED"}, headers=s["officer_headers"])
        assert res.status_code == 400

    def test_rejects_an_empty_string_reason_with_400(self, db, client):
        s = _seed(db)
        alert = _fresh_alert(db, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
        res = client.patch(f"/api/v1/governance-alerts/{alert.id}/status", json={"status": "ACKNOWLEDGED", "reason": ""}, headers=s["officer_headers"])
        assert res.status_code == 400

    def test_returns_404_for_an_unknown_alert(self, db, client):
        s = _seed(db)
        res = client.patch("/api/v1/governance-alerts/00000000-0000-0000-0000-000000000000/status", json={"status": "ACKNOWLEDGED", "reason": "x"}, headers=s["officer_headers"])
        assert res.status_code == 404

    def test_rejects_an_unauthenticated_request_with_401(self, db, client):
        s = _seed(db)
        res = client.patch(f"/api/v1/governance-alerts/{s['flood_alert'].id}/status", json={"status": "ACKNOWLEDGED", "reason": "x"})
        assert res.status_code == 401
