"""Tests for the snapshot-based revert endpoint.

The chat route stores a Project snapshot in the ``plan_adapted`` event
payload before mutating; ``POST /events/{id}/revert`` restores it.
"""

from __future__ import annotations

from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app.db import events as project_events
from app.db.models import PhaseDB, ProjectEventDB, StepDB
from app.db.session import get_engine
from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def _create_project_with_plan(client: TestClient) -> tuple[str, UUID, UUID]:
    """Create a project and seed it with a phase + 2 steps. Returns
    (project_id, phase_id, step_id)."""
    resp = client.post(
        "/projects/",
        json={
            "name": "Revert test",
            "description": "d",
            "objective": "o",
        },
    )
    assert resp.status_code == 201
    project_id = resp.json()["id"]

    SessionLocal = sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)
    phase_id = uuid4()
    step_a_id = uuid4()
    step_b_id = uuid4()
    with SessionLocal() as db:
        phase = PhaseDB(id=phase_id, project_id=UUID(project_id), name="Phase 1", order=0)
        db.add(phase)
        db.flush()
        db.add(
            StepDB(
                id=step_a_id,
                phase_id=phase.id,
                parent_step_id=None,
                name="Step A",
                objective="oa",
                step_type="other",
                status="not_started",
                order=0,
            )
        )
        db.add(
            StepDB(
                id=step_b_id,
                phase_id=phase.id,
                parent_step_id=None,
                name="Step B",
                objective="ob",
                step_type="other",
                status="not_started",
                order=1,
            )
        )
        db.commit()

    return project_id, phase_id, step_a_id


def _record_adapt_event(project_id: str, snapshot: dict) -> UUID:
    """Manually emit a plan_adapted event with the given snapshot."""
    SessionLocal = sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)
    with SessionLocal() as db:
        ev = project_events.emit_event(
            db,
            project_id=UUID(project_id),
            event_type=project_events.PLAN_ADAPTED,
            source="chat",
            payload={"summaries": ["added 'X'"], "snapshot": snapshot},
        )
        db.commit()
        db.refresh(ev)
        return ev.id


def test_revert_restores_previous_plan(client: TestClient):
    project_id, _phase_id, step_a_id = _create_project_with_plan(client)

    # Capture the current plan as the "pre-mutation" snapshot.
    pre = client.get(f"/projects/{project_id}").json()
    event_id = _record_adapt_event(project_id, pre)

    # Mutate the plan in place: rename Step A and add a new step.
    SessionLocal = sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)
    with SessionLocal() as db:
        a = db.get(StepDB, step_a_id)
        assert a is not None
        a.name = "Step A renamed"
        db.add(
            StepDB(
                id=uuid4(),
                phase_id=a.phase_id,
                parent_step_id=None,
                name="Step C (new)",
                objective="oc",
                step_type="other",
                status="not_started",
                order=2,
            )
        )
        db.commit()

    mutated = client.get(f"/projects/{project_id}").json()
    assert mutated["phases"][0]["steps"][0]["name"] == "Step A renamed"
    assert len(mutated["phases"][0]["steps"]) == 3

    # Revert.
    resp = client.post(f"/projects/{project_id}/events/{event_id}/revert")
    assert resp.status_code == 200, resp.text
    restored = resp.json()

    names = sorted(s["name"] for s in restored["phases"][0]["steps"])
    assert names == ["Step A", "Step B"]
    # IDs preserved across revert
    assert restored["phases"][0]["steps"][0]["id"] == str(step_a_id)


def test_revert_emits_plan_reverted_event(client: TestClient):
    project_id, _, _ = _create_project_with_plan(client)
    pre = client.get(f"/projects/{project_id}").json()
    event_id = _record_adapt_event(project_id, pre)

    client.post(f"/projects/{project_id}/events/{event_id}/revert").raise_for_status()

    events = client.get(f"/projects/{project_id}/events").json()
    types = [e["event_type"] for e in events]
    assert "plan_reverted" in types

    SessionLocal = sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)
    with SessionLocal() as db:
        ev = (
            db.query(ProjectEventDB)
            .filter(
                ProjectEventDB.project_id == UUID(project_id),
                ProjectEventDB.event_type == "plan_reverted",
            )
            .first()
        )
        assert ev is not None
        assert ev.payload["reverted_event_id"] == str(event_id)


def test_revert_404_unknown_event(client: TestClient):
    project_id, _, _ = _create_project_with_plan(client)
    resp = client.post(f"/projects/{project_id}/events/{uuid4()}/revert")
    assert resp.status_code == 404


def test_revert_400_wrong_event_type(client: TestClient):
    project_id, _, _ = _create_project_with_plan(client)
    # Find the project_created event
    events = client.get(f"/projects/{project_id}/events").json()
    created = next(e for e in events if e["event_type"] == "project_created")
    resp = client.post(f"/projects/{project_id}/events/{created['id']}/revert")
    assert resp.status_code == 400
