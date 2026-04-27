from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.main import app

_VALID_PROJECT = {
    "name": "Test Project",
    "description": "A test project",
    "objective": "Validate CRUD",
}


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_create_project(client: TestClient):
    resp = client.post("/projects/", json=_VALID_PROJECT)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Test Project"
    assert data["objective"] == "Validate CRUD"
    assert data["phases"] == []
    # valid UUID
    UUID(data["id"])


def test_create_project_with_optional_fields(client: TestClient):
    body = {
        **_VALID_PROJECT,
        "name": "Full Project",
        "business_context": "Enterprise context",
        "constraints": "Must use Python",
    }
    resp = client.post("/projects/", json=body)
    assert resp.status_code == 201
    data = resp.json()
    assert data["business_context"] == "Enterprise context"
    assert data["constraints"] == "Must use Python"


def test_create_project_validation_error(client: TestClient):
    resp = client.post("/projects/", json={"name": "", "description": "x", "objective": "x"})
    assert resp.status_code == 422


def test_list_projects(client: TestClient):
    # Create two projects
    client.post("/projects/", json={**_VALID_PROJECT, "name": "P1"})
    client.post("/projects/", json={**_VALID_PROJECT, "name": "P2"})

    resp = client.get("/projects/")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 2
    names = [p["name"] for p in data]
    assert "P1" in names
    assert "P2" in names


def test_get_project(client: TestClient):
    resp = client.post("/projects/", json=_VALID_PROJECT)
    pid = resp.json()["id"]

    resp = client.get(f"/projects/{pid}")
    assert resp.status_code == 200
    assert resp.json()["id"] == pid


def test_get_project_not_found(client: TestClient):
    fake_id = "00000000-0000-0000-0000-000000000000"
    resp = client.get(f"/projects/{fake_id}")
    assert resp.status_code == 404


def test_update_project(client: TestClient):
    resp = client.post("/projects/", json=_VALID_PROJECT)
    pid = resp.json()["id"]

    updated = {
        "name": "Updated Name",
        "description": "Updated desc",
        "objective": "New objective",
    }
    resp = client.put(f"/projects/{pid}", json=updated)
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Updated Name"
    assert data["objective"] == "New objective"
    assert data["business_context"] is None


def test_update_project_not_found(client: TestClient):
    fake_id = "00000000-0000-0000-0000-000000000000"
    resp = client.put(f"/projects/{fake_id}", json=_VALID_PROJECT)
    assert resp.status_code == 404
