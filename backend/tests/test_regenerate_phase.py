"""Tests for the `regenerate_phase` adapt-plan operation.

The phase-scoped re-planner is mocked so we don't depend on a live LLM.
We verify:
- Only the targeted phase is touched.
- Other phases (and their step IDs/statuses) survive untouched.
- A phase with in-progress / completed work is refused (skip).
"""

from __future__ import annotations

from unittest.mock import patch
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app.agents.chat import (
    ChatAction,
    ChatResponse,
    PlanOperation,
)
from app.db.models import PhaseDB, StepDB
from app.db.session import get_engine
from app.main import app
from app.schemas.enums import StepType
from app.schemas.step import Step


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def _seed_two_phase_project(client: TestClient) -> tuple[str, UUID, list[UUID]]:
    """Returns (project_id, frontend_phase_id, [other_phase_step_ids])."""
    pid = client.post(
        "/projects/", json={"name": "Regen", "description": "d", "objective": "o"}
    ).json()["id"]

    SessionLocal = sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)
    backend_phase_id = uuid4()
    frontend_phase_id = uuid4()
    backend_step_ids = [uuid4(), uuid4()]
    frontend_step_ids = [uuid4(), uuid4()]
    with SessionLocal() as db:
        backend = PhaseDB(
            id=backend_phase_id, project_id=UUID(pid), name="Backend", order=0
        )
        db.add(backend)
        db.flush()
        for i, sid in enumerate(backend_step_ids):
            db.add(
                StepDB(
                    id=sid,
                    phase_id=backend.id,
                    parent_step_id=None,
                    name=f"BE Step {i}",
                    objective="o",
                    step_type="backend",
                    status="not_started",
                    order=i,
                )
            )
        frontend = PhaseDB(
            id=frontend_phase_id,
            project_id=UUID(pid),
            name="Frontend UI",
            order=1,
        )
        db.add(frontend)
        db.flush()
        for i, sid in enumerate(frontend_step_ids):
            db.add(
                StepDB(
                    id=sid,
                    phase_id=frontend.id,
                    parent_step_id=None,
                    name=f"FE Step {i}",
                    objective="o",
                    step_type="frontend",
                    status="not_started",
                    order=i,
                )
            )
        db.commit()
    return pid, frontend_phase_id, backend_step_ids


def _mock_chat(action: ChatAction):
    """Returns a coroutine that mimics chat_with_agent."""

    async def fake(messages, project_context=""):  # noqa: ARG001
        return ChatResponse(message="OK", ready_to_plan=True, action=action)

    return fake


def _mock_phase_planner(steps: list[Step]):
    async def fake(*, project, plan_tree, phase_name, instructions):  # noqa: ARG001
        return steps

    return fake


def test_regenerate_phase_replaces_only_target_phase(client: TestClient):
    project_id, _frontend_phase_id, backend_step_ids = _seed_two_phase_project(client)

    new_steps = [
        Step(name="Reflex setup", objective="install reflex", step_type=StepType.frontend, order=0),
        Step(name="Reflex pages", objective="root + plan pages", step_type=StepType.frontend, order=1),
        Step(name="Reflex state", objective="state classes", step_type=StepType.frontend, order=2),
    ]
    action = ChatAction(
        type="adapt_plan",
        operations=[
            PlanOperation(
                op="regenerate_phase",
                phase_name="Frontend UI",
                instructions="Use Reflex (Python full-stack)",
            )
        ],
    )

    with (
        patch("app.routes.projects.chat_with_agent", _mock_chat(action)),
        patch("app.agents.plan.regenerate_phase_steps", _mock_phase_planner(new_steps)),
    ):
        resp = client.post(
            f"/projects/{project_id}/chat",
            json={"message": "use reflex for the frontend phase", "history": []},
        )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["action"] == "adapt_plan"
    assert body["event_id"]
    summaries = body["adapt_summaries"]
    assert all(not s.startswith("skipped:") for s in summaries)
    assert any("Reflex setup" in s for s in summaries)

    proj = client.get(f"/projects/{project_id}").json()
    phases_by_name = {p["name"]: p for p in proj["phases"]}

    # Frontend phase fully replaced
    fe_step_names = [s["name"] for s in phases_by_name["Frontend UI"]["steps"]]
    assert fe_step_names == ["Reflex setup", "Reflex pages", "Reflex state"]

    # Backend phase untouched -- same step IDs survive
    be_ids = {UUID(s["id"]) for s in phases_by_name["Backend"]["steps"]}
    assert be_ids == set(backend_step_ids)


def test_regenerate_phase_refuses_when_work_in_progress(client: TestClient):
    project_id, frontend_phase_id, _ = _seed_two_phase_project(client)

    # Mark one frontend step as in_progress.
    SessionLocal = sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)
    with SessionLocal() as db:
        phase = db.get(PhaseDB, frontend_phase_id)
        assert phase is not None
        phase.steps[0].status = "in_progress"
        db.commit()

    new_steps = [
        Step(name="Reflex setup", objective="x", step_type=StepType.frontend, order=0),
    ]
    action = ChatAction(
        type="adapt_plan",
        operations=[
            PlanOperation(
                op="regenerate_phase",
                phase_name="Frontend UI",
                instructions="Use Reflex",
            )
        ],
    )

    with (
        patch("app.routes.projects.chat_with_agent", _mock_chat(action)),
        patch("app.agents.plan.regenerate_phase_steps", _mock_phase_planner(new_steps)),
    ):
        resp = client.post(
            f"/projects/{project_id}/chat",
            json={"message": "use reflex", "history": []},
        )
    assert resp.status_code == 200
    body = resp.json()

    # No applied summaries -> action should be cleared.
    assert body["action"] is None
    summaries = body["adapt_summaries"]
    assert summaries and all(s.startswith("skipped:") for s in summaries)
    assert "in progress" in summaries[0]
