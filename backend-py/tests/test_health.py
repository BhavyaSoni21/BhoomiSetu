from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "timestamp" in body


def test_health_check_not_under_api_prefix():
    response = client.get("/api/v1/health")
    assert response.status_code == 404


def test_every_response_carries_a_request_id_header():
    response = client.get("/health")
    assert "X-Request-Id" in response.headers


def test_incoming_request_id_is_honored():
    response = client.get("/health", headers={"X-Request-Id": "abc-123"})
    assert response.headers["X-Request-Id"] == "abc-123"
