"""Tests for admin workflow pipeline configuration endpoints."""

from app.models.audit import AuditLog
from app.models.user import User
from app.models.workflow import WorkflowPipelineConfig
from tests.helpers.auth import create_authenticated_user


def _seed(db):
    db.query(User).delete()
    db.query(AuditLog).delete()
    db.query(WorkflowPipelineConfig).delete()
    db.flush()
    admin, _, admin_headers = create_authenticated_user(db, "ADMIN")
    return {"admin": admin, "admin_headers": admin_headers}


class TestPipelineConfigFindAll:
    def test_lists_all_pipeline_configs(self, db, client):
        s = _seed(db)
        # Create a couple of configs
        config1 = WorkflowPipelineConfig(
            workflow_type="TEST_TYPE_1",
            stages_json='[{"department": "LAND_RECORDS", "assigned_role": "LAND_RECORD_OFFICER", "step_order": 1}]',
            is_active=True,
        )
        config2 = WorkflowPipelineConfig(
            workflow_type="TEST_TYPE_2",
            stages_json='[{"department": "DISPUTE", "assigned_role": "DISPUTE_OFFICER", "step_order": 1}]',
            is_active=True,
        )
        db.add_all([config1, config2])
        db.flush()

        res = client.get("/api/v1/admin/workflow-pipelines", headers=s["admin_headers"])
        assert res.status_code == 200
        data = res.json()
        assert len(data) >= 2
        workflow_types = [c["workflowType"] for c in data]
        assert "TEST_TYPE_1" in workflow_types
        assert "TEST_TYPE_2" in workflow_types

    def test_rejects_non_admin_with_403(self, db, client):
        s = _seed(db)
        _, _, officer_headers = create_authenticated_user(db, "LAND_RECORD_OFFICER")
        res = client.get("/api/v1/admin/workflow-pipelines", headers=officer_headers)
        assert res.status_code == 403

    def test_rejects_unauthenticated_with_401(self, db, client):
        _seed(db)
        res = client.get("/api/v1/admin/workflow-pipelines")
        assert res.status_code == 401


class TestPipelineConfigCreate:
    def test_creates_new_pipeline_config(self, db, client):
        s = _seed(db)
        res = client.post(
            "/api/v1/admin/workflow-pipelines",
            headers=s["admin_headers"],
            json={
                "workflowType": "CUSTOM_WORKFLOW",
                "stages": [
                    {"department": "LAND_RECORDS", "assignedRole": "LAND_RECORD_OFFICER", "stepOrder": 1},
                    {"department": "TAX", "assignedRole": "TAX_OFFICER", "stepOrder": 2},
                ],
                "isActive": True,
            },
        )
        assert res.status_code == 201
        data = res.json()
        assert data["workflowType"] == "CUSTOM_WORKFLOW"
        assert len(data["stages"]) == 2
        assert data["stages"][0]["department"] == "LAND_RECORDS"
        assert data["stages"][1]["department"] == "TAX"
        assert data["isActive"] is True

        # Verify in DB
        config = db.query(WorkflowPipelineConfig).filter(WorkflowPipelineConfig.workflow_type == "CUSTOM_WORKFLOW").first()
        assert config is not None
        assert config.is_active is True

    def test_rejects_duplicate_workflow_type_with_409(self, db, client):
        s = _seed(db)
        client.post(
            "/api/v1/admin/workflow-pipelines",
            headers=s["admin_headers"],
            json={"workflowType": "DUPLICATE_TYPE", "stages": [{"department": "LAND_RECORDS", "assignedRole": "LAND_RECORD_OFFICER", "stepOrder": 1}]},
        )
        res = client.post(
            "/api/v1/admin/workflow-pipelines",
            headers=s["admin_headers"],
            json={"workflowType": "DUPLICATE_TYPE", "stages": [{"department": "DISPUTE", "assignedRole": "DISPUTE_OFFICER", "stepOrder": 1}]},
        )
        assert res.status_code == 409

    def test_rejects_empty_stages_with_400(self, db, client):
        s = _seed(db)
        res = client.post(
            "/api/v1/admin/workflow-pipelines",
            headers=s["admin_headers"],
            json={"workflowType": "EMPTY_STAGES", "stages": []},
        )
        assert res.status_code == 400

    def test_rejects_non_admin_with_403(self, db, client):
        s = _seed(db)
        _, _, officer_headers = create_authenticated_user(db, "LAND_RECORD_OFFICER")
        res = client.post(
            "/api/v1/admin/workflow-pipelines",
            headers=officer_headers,
            json={"workflowType": "BLOCKED", "stages": [{"department": "LAND_RECORDS", "assignedRole": "LAND_RECORD_OFFICER", "stepOrder": 1}]},
        )
        assert res.status_code == 403


class TestPipelineConfigUpdate:
    def test_updates_stages(self, db, client):
        s = _seed(db)
        create_res = client.post(
            "/api/v1/admin/workflow-pipelines",
            headers=s["admin_headers"],
            json={"workflowType": "UPDATE_TEST", "stages": [{"department": "LAND_RECORDS", "assignedRole": "LAND_RECORD_OFFICER", "stepOrder": 1}]},
        )
        config_id = create_res.json()["id"]

        res = client.patch(
            f"/api/v1/admin/workflow-pipelines/{config_id}",
            headers=s["admin_headers"],
            json={
                "stages": [
                    {"department": "LAND_RECORDS", "assignedRole": "LAND_RECORD_OFFICER", "stepOrder": 1},
                    {"department": "REGISTRATION", "assignedRole": "REGISTRATION_OFFICER", "stepOrder": 2},
                    {"department": "PLANNING", "assignedRole": "PLANNING_OFFICER", "stepOrder": 3},
                ]
            },
        )
        assert res.status_code == 200
        assert len(res.json()["stages"]) == 3
        assert res.json()["stages"][1]["department"] == "REGISTRATION"

    def test_updates_is_active(self, db, client):
        s = _seed(db)
        create_res = client.post(
            "/api/v1/admin/workflow-pipelines",
            headers=s["admin_headers"],
            json={"workflowType": "ACTIVE_TEST", "stages": [{"department": "LAND_RECORDS", "assignedRole": "LAND_RECORD_OFFICER", "stepOrder": 1}], "isActive": True},
        )
        config_id = create_res.json()["id"]

        res = client.patch(
            f"/api/v1/admin/workflow-pipelines/{config_id}",
            headers=s["admin_headers"],
            json={"isActive": False},
        )
        assert res.status_code == 200
        assert res.json()["isActive"] is False

    def test_returns_404_for_unknown_config(self, db, client):
        s = _seed(db)
        res = client.patch(
            "/api/v1/admin/workflow-pipelines/00000000-0000-0000-0000-000000000000",
            headers=s["admin_headers"],
            json={"isActive": False},
        )
        assert res.status_code == 404


class TestPipelineConfigDelete:
    def test_deletes_config(self, db, client):
        s = _seed(db)
        create_res = client.post(
            "/api/v1/admin/workflow-pipelines",
            headers=s["admin_headers"],
            json={"workflowType": "DELETE_TEST", "stages": [{"department": "LAND_RECORDS", "assignedRole": "LAND_RECORD_OFFICER", "stepOrder": 1}]},
        )
        config_id = create_res.json()["id"]

        res = client.delete(f"/api/v1/admin/workflow-pipelines/{config_id}", headers=s["admin_headers"])
        assert res.status_code == 204

        assert db.get(WorkflowPipelineConfig, config_id) is None

    def test_returns_404_for_unknown_config(self, db, client):
        s = _seed(db)
        res = client.delete("/api/v1/admin/workflow-pipelines/00000000-0000-0000-0000-000000000000", headers=s["admin_headers"])
        assert res.status_code == 404