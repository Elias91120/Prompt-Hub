"""Tests for the persistent chat-history endpoints."""

import pytest
from fastapi.testclient import TestClient

from app.agents.chat import ChatResponse
from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def _make_project(client: TestClient) -> str:
    resp = client.post(
        "/projects/",
        json={
            "name": "Chat history project",
            "description": "for chat history tests",
            "objective": "validate persistence",
        },
    )
    assert resp.status_code == 201
    return resp.json()["id"]


def _patch_chat_agent(monkeypatch, reply: str = "ack") -> None:
    """Bypass the LLM by replacing chat_with_agent in the route module."""

    async def _fake(*_args, **_kwargs):
        return ChatResponse(message=reply, ready_to_plan=False, action=None)

    monkeypatch.setattr("app.routes.projects.chat_with_agent", _fake)


def test_history_empty_initially(client: TestClient):
    project_id = _make_project(client)
    resp = client.get(f"/projects/{project_id}/chat/history")
    assert resp.status_code == 200
    assert resp.json() == []


def test_history_404_for_unknown_project(client: TestClient):
    resp = client.get("/projects/00000000-0000-0000-0000-000000000000/chat/history")
    assert resp.status_code == 404


def test_chat_persists_user_and_agent(client: TestClient, monkeypatch):
    project_id = _make_project(client)
    _patch_chat_agent(monkeypatch, reply="hello back")

    resp = client.post(
        f"/projects/{project_id}/chat",
        json={"message": "hello", "history": []},
    )
    assert resp.status_code == 200

    history = client.get(f"/projects/{project_id}/chat/history").json()
    assert [h["role"] for h in history] == ["user", "agent"]
    assert history[0]["content"] == "hello"
    assert history[1]["content"] == "hello back"
    assert history[0]["step_id"] is None
    # ascending order by created_at
    assert history[0]["created_at"] <= history[1]["created_at"]


def test_chat_skips_initial_start_greeting(client: TestClient, monkeypatch):
    project_id = _make_project(client)
    _patch_chat_agent(monkeypatch, reply="welcome")

    # Synthetic mount-time greeting: must NOT pollute history.
    resp = client.post(
        f"/projects/{project_id}/chat",
        json={"message": "Start", "history": []},
    )
    assert resp.status_code == 200

    history = client.get(f"/projects/{project_id}/chat/history").json()
    assert history == []


def test_clear_chat_history(client: TestClient, monkeypatch):
    project_id = _make_project(client)
    _patch_chat_agent(monkeypatch)

    client.post(
        f"/projects/{project_id}/chat",
        json={"message": "msg 1", "history": []},
    )
    history = client.get(f"/projects/{project_id}/chat/history").json()
    assert len(history) == 2

    resp = client.delete(f"/projects/{project_id}/chat/history")
    assert resp.status_code == 204

    history = client.get(f"/projects/{project_id}/chat/history").json()
    assert history == []


def test_focus_step_id_is_persisted(client: TestClient, monkeypatch):
    """When focus_step_id is provided, both records carry it."""
    # Create a project with a real plan so we have a valid step UUID.
    project_id = _make_project(client)

    # Inject a phase + step directly via the projects API. We add a phase
    # by hitting the /seed endpoint if available -- otherwise we craft one
    # via the SQLAlchemy session.
    from uuid import UUID, uuid4

    from sqlalchemy.orm import sessionmaker

    from app.db.models import PhaseDB, StepDB
    from app.db.session import get_engine

    SessionLocal = sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)
    step_id = uuid4()
    with SessionLocal() as db:
        phase = PhaseDB(
            id=uuid4(),
            project_id=UUID(project_id),
            name="P1",
            order=0,
        )
        db.add(phase)
        db.flush()
        step = StepDB(
            id=step_id,
            phase_id=phase.id,
            parent_step_id=None,
            name="S1",
            objective="o",
            step_type="other",
            status="not_started",
            order=0,
        )
        db.add(step)
        db.commit()

    _patch_chat_agent(monkeypatch, reply="ok")
    resp = client.post(
        f"/projects/{project_id}/chat",
        json={
            "message": "I'm stuck on this step",
            "history": [],
            "focus_step_id": str(step_id),
        },
    )
    assert resp.status_code == 200

    history = client.get(f"/projects/{project_id}/chat/history").json()
    assert len(history) == 2
    assert history[0]["step_id"] == str(step_id)
    assert history[1]["step_id"] == str(step_id)
