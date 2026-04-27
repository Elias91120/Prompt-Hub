"""Restore a project's plan from a snapshot dict (Project.model_dump).

Used by the "undo last plan adaptation" feature: the chat route stores
``Project.model_dump(mode="json")`` in the ``plan_adapted`` event payload
*before* applying any operation. ``revert`` reapplies that snapshot.

The restore preserves UUIDs whenever possible so the frontend's
``selectedStep`` / focus handles keep working after a revert.

Only the *plan* (phases, steps, sub-steps, statuses, types, orders) is
restored. Project-level fields (name, constraints, etc.) are left
untouched -- they are not touched by adapt_plan operations either.
"""

from __future__ import annotations

import uuid
from typing import Any

from app.db.models import PhaseDB, ProjectDB, StepDB


def _coerce_uuid(value: Any) -> uuid.UUID:
    if isinstance(value, uuid.UUID):
        return value
    return uuid.UUID(str(value))


def restore_plan_from_snapshot(project: ProjectDB, snapshot: dict) -> None:
    """Replace ``project.phases`` with the structure described by ``snapshot``.

    ``snapshot`` is the dict produced by ``Project.model_dump(mode="json")``.
    The caller owns the surrounding ``db.commit()``.
    """
    phases_payload = snapshot.get("phases") or []

    # Cascade-delete the current plan. SQLAlchemy will issue DELETEs for
    # phases, steps and sub-steps thanks to the cascade="all, delete-orphan"
    # on the relationships.
    project.phases.clear()

    for phase_data in phases_payload:
        phase = PhaseDB(
            id=_coerce_uuid(phase_data["id"]),
            name=str(phase_data.get("name", "")),
            order=int(phase_data.get("order", 0)),
        )

        # Two passes over steps: first add top-level steps so their IDs
        # exist as potential parents, then attach sub-steps. A snapshot
        # produced by Project.model_dump nests sub_steps inside each parent.
        for step_data in phase_data.get("steps", []):
            phase.steps.append(_step_from_snapshot(step_data, parent_id=None))
            for sub_data in step_data.get("sub_steps", []):
                phase.steps.append(
                    _step_from_snapshot(sub_data, parent_id=_coerce_uuid(step_data["id"]))
                )

        project.phases.append(phase)


def _step_from_snapshot(data: dict, *, parent_id: uuid.UUID | None) -> StepDB:
    return StepDB(
        id=_coerce_uuid(data["id"]),
        name=str(data.get("name", "")),
        objective=str(data.get("objective", "")),
        status=str(data.get("status", "not_started")),
        step_type=str(data.get("step_type", "other")),
        order=int(data.get("order", 0)),
        parent_step_id=parent_id,
    )
