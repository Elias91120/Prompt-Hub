"""Project event emission helper (audit log / timeline).

Append-only events captured for every meaningful action on a project.
Used by the timeline UI and (later) by analysis agents.
"""

from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.db.models import ProjectEventDB


# Event-type taxonomy. Kept as plain strings to stay schema-light and
# allow new types to be added without migration.
PROJECT_CREATED = "project_created"
PROJECT_UPDATED = "project_updated"
PLAN_GENERATED = "plan_generated"
PLAN_ADAPTED = "plan_adapted"
PLAN_REVERTED = "plan_reverted"
PROMPT_GENERATED = "prompt_generated"
SUB_STEPS_GENERATED = "sub_steps_generated"
STEP_STATUS_CHANGED = "step_status_changed"
FEEDBACK_APPLIED = "feedback_applied"


def emit_event(
    db: Session,
    *,
    project_id: UUID,
    event_type: str,
    payload: dict[str, Any] | None = None,
    step_id: UUID | None = None,
    source: str = "manual",
    agent_chain: list[str] | None = None,
) -> ProjectEventDB:
    """Insert an event row. Caller is responsible for the surrounding commit.

    Parameters
    ----------
    agent_chain:
        Ordered list of agent names that participated in producing this event
        (e.g. ``["router", "prompt"]``). Stored under
        ``payload["agent_chain"]`` so the timeline UI can render a Squad-style
        orchestration trail. The chain is intentionally additive: a single
        agent producing a single event still records ``[source]`` so the
        format stays uniform.
    """
    final_payload: dict[str, Any] = dict(payload or {})
    if agent_chain is not None:
        final_payload["agent_chain"] = list(agent_chain)
    elif source != "manual" and "agent_chain" not in final_payload:
        # Default chain for single-agent events — keeps the field consistently
        # present so the UI can rely on it.
        final_payload["agent_chain"] = [source]

    row = ProjectEventDB(
        project_id=project_id,
        step_id=step_id,
        event_type=event_type,
        source=source,
        payload=final_payload,
    )
    db.add(row)
    return row
