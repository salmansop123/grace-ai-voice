from fastapi.testclient import TestClient

from main import app


client = TestClient(app)


def test_unauthenticated_request_returns_401() -> None:
    response = client.get("/api/agents")
    assert response.status_code == 401


def test_health_endpoint_public() -> None:
    response = client.get("/health")
    assert response.status_code in {200, 503}
    assert "status" in response.json()
