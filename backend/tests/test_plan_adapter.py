"""Tests for the chat-driven plan adapter.

These tests exercise the surgical edits the chat agent's ``adapt_plan``
action triggers. They build a small project with phases + steps directly
in the DB, run ``apply_operations`` against a list of ``PlanOperation``
instances, and assert the resulting tree shape and statuses.
No LLM is invoked.
"""

from __future__ import annotations

import pytest
from sqlalchemy.orm import Session, joinedload

from app.agents.chat import PlanOperation
from app.db.models import PhaseDB, ProjectDB, StepDB
from app.db.session import get_engine, init_db
from app.schemas.enums import StepStatus, StepType
from app.services.plan_adapter import apply_operations


def _seed_project(db: Session) -> ProjectDB:
    """Backend phase with: Skeleton (completed), JWT auth (in_progress),
    Email notifications (not_started)."""
    project = ProjectDB(name="adapter-test", description="d", objective="o")
    backend = PhaseDB(name="Backend", order=0)
    backend.steps.extend(
        [
            StepDB(
                name="Skeleton",
                objective="FastAPI bootstrap",
                status=StepStatus.completed.value,
                step_type=StepType.backend.value,
                order=0,
            ),
            StepDB(
                name="JWT auth",
                objective="Login + refresh",
                status=StepStatus.in_progress.value,
                step_type=StepType.backend.value,
                order=1,
            ),
            StepDB(
                name="Email notifications",
                objective="Optional outbound emails",
                status=StepStatus.not_started.value,
                step_type=StepType.backend.value,
                order=2,
            ),
        ]
    )
    project.phases.append(backend)
    db.add(project)
    db.commit()
    return _reload(db, project.id)


def _reload(db: Session, project_id) -> ProjectDB:
    return (
        db.query(ProjectDB)
        .options(joinedload(ProjectDB.phases).joinedload(PhaseDB.steps).joinedload(StepDB.sub_steps))
        .filter(ProjectDB.id == project_id)
        .one()
    )


@pytest.fixture
def db() -> Session:
    init_db()
    session = Session(bind=get_engine())
    try:
        yield session
    finally:
        session.rollback()
        session.close()


def test_add_sub_steps_breaks_down_a_blocked_step(db: Session) -> None:
    project = _seed_project(db)
    op = PlanOperation(
        op="add_sub_steps",
        step_name="JWT auth",
        sub_steps=[
            {"name": "Token signer", "objective": "HS256", "step_type": "backend"},
            {"name": "Login route", "objective": "POST /auth/login"},
            {"name": "Refresh route", "objective": "POST /auth/refresh"},
        ],
    )
    summaries = apply_operations(project, [op])
    db.commit()

    assert summaries == ["added 3 sub-step(s) under 'JWT auth'"]
    project = _reload(db, project.id)
    parent = next(s for s in project.phases[0].steps if s.name == "JWT auth")
    assert len(parent.sub_steps) == 3
    assert {c.name for c in parent.sub_steps} == {
        "Token signer",
        "Login route",
        "Refresh route",
    }
    # Child step types default to "other" when missing
    refresh = next(c for c in parent.sub_steps if c.name == "Refresh route")
    assert refresh.step_type == StepType.other.value


def test_add_step_inserts_after_anchor_and_shifts_orders(db: Session) -> None:
    project = _seed_project(db)
    op = PlanOperation(
        op="add_step",
        phase_name="Backend",
        after_step_name="Skeleton",
        new_name="Database migrations",
        new_objective="Alembic + initial schema",
        new_step_type="backend",
    )
    summaries = apply_operations(project, [op])
    db.commit()
    assert summaries == ["added 'Database migrations' to phase 'Backend'"]

    project = _reload(db, project.id)
    ordered = sorted(
        (s for s in project.phases[0].steps if s.parent_step_id is None),
        key=lambda s: s.order,
    )
    names = [s.name for s in ordered]
    assert names == ["Skeleton", "Database migrations", "JWT auth", "Email notifications"]


def test_update_step_marks_replanned(db: Session) -> None:
    project = _seed_project(db)
    op = PlanOperation(
        op="update_step",
        step_name="JWT auth",
        new_objective="OAuth2 password flow + refresh + rotation",
    )
    summaries = apply_operations(project, [op])
    db.commit()
    assert summaries == ["updated 'JWT auth' (objective)"]

    project = _reload(db, project.id)
    step = next(s for s in project.phases[0].steps if s.name == "JWT auth")
    assert step.status == StepStatus.replanned.value
    assert step.objective.startswith("OAuth2")


def test_remove_step_refuses_in_progress(db: Session) -> None:
    project = _seed_project(db)
    summaries = apply_operations(
        project, [PlanOperation(op="remove_step", step_name="JWT auth")]
    )
    assert summaries[0].startswith("skipped: refusing to remove 'JWT auth'")
    project = _reload(db, project.id)
    assert any(s.name == "JWT auth" for s in project.phases[0].steps)


def test_remove_step_drops_not_started(db: Session) -> None:
    project = _seed_project(db)
    summaries = apply_operations(
        project, [PlanOperation(op="remove_step", step_name="Email notifications")]
    )
    db.commit()
    assert summaries == ["removed 'Email notifications'"]
    project = _reload(db, project.id)
    assert all(s.name != "Email notifications" for s in project.phases[0].steps)


def test_unknown_step_is_skipped_safely(db: Session) -> None:
    project = _seed_project(db)
    summaries = apply_operations(
        project,
        [
            PlanOperation(op="update_step", step_name="Nope", new_objective="x"),
            PlanOperation(op="mark_replanned", step_name="JWT auth"),
        ],
    )
    db.commit()
    assert summaries[0].startswith("skipped:")
    assert summaries[1] == "marked 'JWT auth' as replanned"

    project = _reload(db, project.id)
    step = next(s for s in project.phases[0].steps if s.name == "JWT auth")
    assert step.status == StepStatus.replanned.value


def test_step_name_match_is_case_insensitive(db: Session) -> None:
    project = _seed_project(db)
    summaries = apply_operations(
        project, [PlanOperation(op="mark_replanned", step_name="  jwt AUTH  ")]
    )
    assert summaries == ["marked 'JWT auth' as replanned"]
