"""Tests for the small additive improvements:

  * FeedbackAnalysis.prompt_revision (reviewer protocol field)
  * emit_event() agent_chain auto-population
"""

from uuid import uuid4

from app.agents.feedback import FeedbackAnalysis, FeedbackItem
from app.db import events as project_events
from app.db.models import ProjectDB, ProjectEventDB
from app.db.session import get_engine, init_db
from sqlalchemy.orm import Session


def test_prompt_revision_defaults_to_none():
    fa = FeedbackAnalysis(
        summary="x",
        items=[FeedbackItem(description="d", done=True)],
        recommendations=[],
        assumptions=[],
        step_complete=True,
    )
    assert fa.prompt_revision is None


def test_prompt_revision_can_be_set():
    fa = FeedbackAnalysis(
        summary="x",
        items=[FeedbackItem(description="d", done=False)],
        recommendations=[],
        assumptions=[],
        step_complete=False,
        prompt_revision="Reframe the requirement around idempotency.",
    )
    assert fa.prompt_revision == "Reframe the requirement around idempotency."


def test_emit_event_auto_populates_agent_chain_for_agent_source():
    init_db()
    db = Session(bind=get_engine())
    try:
        project = ProjectDB(name="e2e", description="d", objective="o")
        db.add(project)
        db.commit()
        db.refresh(project)

        project_events.emit_event(
            db,
            project_id=project.id,
            event_type=project_events.PROMPT_GENERATED,
            source="prompt_agent",
            payload={"step_name": "s"},
        )
        db.commit()

        row = (
            db.query(ProjectEventDB)
            .filter(ProjectEventDB.project_id == project.id)
            .order_by(ProjectEventDB.created_at.desc())
            .first()
        )
        assert row is not None
        assert row.payload.get("agent_chain") == ["prompt_agent"]
        assert row.payload.get("step_name") == "s"
    finally:
        db.close()


def test_emit_event_explicit_chain_overrides_default():
    init_db()
    db = Session(bind=get_engine())
    try:
        project = ProjectDB(name="e2e2", description="d", objective="o")
        db.add(project)
        db.commit()
        db.refresh(project)

        project_events.emit_event(
            db,
            project_id=project.id,
            event_type=project_events.FEEDBACK_APPLIED,
            source="feedback_agent",
            payload={},
            agent_chain=["router", "feedback"],
        )
        db.commit()

        row = (
            db.query(ProjectEventDB)
            .filter(ProjectEventDB.project_id == project.id)
            .order_by(ProjectEventDB.created_at.desc())
            .first()
        )
        assert row is not None
        assert row.payload["agent_chain"] == ["router", "feedback"]
    finally:
        db.close()


def test_emit_event_manual_source_does_not_inject_chain():
    init_db()
    db = Session(bind=get_engine())
    try:
        project = ProjectDB(name="e2e3", description="d", objective="o")
        db.add(project)
        db.commit()
        db.refresh(project)

        project_events.emit_event(
            db,
            project_id=project.id,
            event_type=project_events.STEP_STATUS_CHANGED,
            payload={"x": 1},
        )
        db.commit()

        row = (
            db.query(ProjectEventDB)
            .filter(ProjectEventDB.project_id == project.id)
            .order_by(ProjectEventDB.created_at.desc())
            .first()
        )
        assert row is not None
        assert "agent_chain" not in row.payload
    finally:
        db.close()


# silence unused-import warning when pyflakes runs
_ = uuid4
