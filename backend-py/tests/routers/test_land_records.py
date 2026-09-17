"""Ported from backend/test/land-records.e2e-spec.ts.

Fully self-contained (no auth, no cross-module dependencies) - a
complete, unscoped port of the original spec.
"""

from app.models.land_records import StateALandRecord, StateBLandRecord


def _seed(db):
    db.query(StateALandRecord).delete()
    db.query(StateBLandRecord).delete()
    db.add(StateALandRecord(survey_number="42/3", subdivision_number="1", owner_name="Sample Citizen", village_code="VIL001", area_hectares=0.85))
    db.add(StateBLandRecord(plot_id="P-9087", holder_name="Sample Citizen", locality_id="LOC900", land_extent_sqft=9150, record_category="Urban"))
    db.flush()


class TestStateALandRecords:
    def test_creates_a_record_defaulting_record_status_to_active(self, db, client):
        _seed(db)
        res = client.post(
            "/api/v1/state-a/land-records",
            json={"surveyNumber": "10/2", "subdivisionNumber": "4", "ownerName": "Test Owner", "villageCode": "VIL010", "areaHectares": 1.2},
        )
        assert res.status_code == 201
        body = res.json()
        assert body["recordStatus"] == "ACTIVE"
        assert body["recordId"]

    def test_rejects_a_create_request_missing_required_fields_with_400(self, db, client):
        _seed(db)
        res = client.post("/api/v1/state-a/land-records", json={"surveyNumber": "10/2"})
        assert res.status_code == 400

    def test_lists_all_records_and_supports_the_schema_specific_filters(self, db, client):
        _seed(db)
        all_res = client.get("/api/v1/state-a/land-records")
        assert all_res.status_code == 200
        assert all_res.json()["total"] >= 1

        filtered = client.get("/api/v1/state-a/land-records", params={"survey_number": "42/3"})
        assert filtered.status_code == 200
        body = filtered.json()
        assert body["total"] == 1
        assert body["records"][0]["villageCode"] == "VIL001"

    def test_reads_updates_and_deletes_a_single_record(self, db, client):
        _seed(db)
        created = client.post(
            "/api/v1/state-a/land-records",
            json={"surveyNumber": "55/1", "subdivisionNumber": "2", "ownerName": "Lifecycle Owner", "villageCode": "VIL055", "areaHectares": 2},
        )
        assert created.status_code == 201
        record_id = created.json()["recordId"]

        fetched = client.get(f"/api/v1/state-a/land-records/{record_id}")
        assert fetched.status_code == 200
        assert fetched.json()["ownerName"] == "Lifecycle Owner"

        updated = client.patch(f"/api/v1/state-a/land-records/{record_id}", json={"ownerName": "Renamed Owner"})
        assert updated.status_code == 200
        assert updated.json()["ownerName"] == "Renamed Owner"
        assert updated.json()["surveyNumber"] == "55/1"

        deleted = client.delete(f"/api/v1/state-a/land-records/{record_id}")
        assert deleted.status_code == 204
        assert client.get(f"/api/v1/state-a/land-records/{record_id}").status_code == 404

    def test_returns_404_for_an_unknown_id_on_get_update_delete(self, db, client):
        _seed(db)
        missing = "00000000-0000-0000-0000-000000000000"
        assert client.get(f"/api/v1/state-a/land-records/{missing}").status_code == 404
        assert client.patch(f"/api/v1/state-a/land-records/{missing}", json={"ownerName": "X"}).status_code == 404
        assert client.delete(f"/api/v1/state-a/land-records/{missing}").status_code == 404


class TestStateBLandRecords:
    def test_creates_and_reads_back_a_record_using_its_own_field_names(self, db, client):
        _seed(db)
        created = client.post(
            "/api/v1/state-b/land-records",
            json={"plotId": "P-1234", "holderName": "Urban Owner", "localityId": "LOC010", "landExtentSqft": 5000, "recordCategory": "Commercial"},
        )
        assert created.status_code == 201
        record_id = created.json()["recordId"]
        assert record_id

        fetched = client.get(f"/api/v1/state-b/land-records/{record_id}")
        assert fetched.status_code == 200
        assert fetched.json()["plotId"] == "P-1234"
        assert fetched.json()["recordCategory"] == "Commercial"

    def test_rejects_a_create_request_missing_required_fields_with_400(self, db, client):
        _seed(db)
        res = client.post("/api/v1/state-b/land-records", json={"plotId": "P-0000"})
        assert res.status_code == 400

    def test_filters_by_plot_id_locality_id_independently_of_state_a_data(self, db, client):
        _seed(db)
        res = client.get("/api/v1/state-b/land-records", params={"plot_id": "P-9087"})
        assert res.status_code == 200
        body = res.json()
        assert body["total"] == 1
        assert body["records"][0]["holderName"] == "Sample Citizen"
        assert "surveyNumber" not in body["records"][0]
        assert "villageCode" not in body["records"][0]

    def test_updates_and_deletes_a_record(self, db, client):
        _seed(db)
        created = client.post(
            "/api/v1/state-b/land-records",
            json={"plotId": "P-5555", "holderName": "Delete Me", "localityId": "LOC055", "landExtentSqft": 1000, "recordCategory": "Residential"},
        )
        assert created.status_code == 201
        record_id = created.json()["recordId"]

        updated = client.patch(f"/api/v1/state-b/land-records/{record_id}", json={"recordCategory": "Mixed-Use"})
        assert updated.status_code == 200

        deleted = client.delete(f"/api/v1/state-b/land-records/{record_id}")
        assert deleted.status_code == 204
        assert client.get(f"/api/v1/state-b/land-records/{record_id}").status_code == 404


class TestTheTwoStateApisOperateIndependently:
    def test_state_a_and_state_b_counts_do_not_interfere_with_each_other(self, db, client):
        _seed(db)
        state_a_count = db.query(StateALandRecord).count()
        state_b_count = db.query(StateBLandRecord).count()

        state_a_res = client.get("/api/v1/state-a/land-records")
        state_b_res = client.get("/api/v1/state-b/land-records")

        assert state_a_res.json()["total"] == state_a_count
        assert state_b_res.json()["total"] == state_b_count
