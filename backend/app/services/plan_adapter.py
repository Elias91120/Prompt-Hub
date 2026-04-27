"""Apply chat-agent-proposed surgical edits to an existing plan.

The chat agent emits a list of ``PlanOperation`` objects when the user
asks to adapt (not regenerate) the plan. This service resolves those
operations into concrete SQLAlchemy mutations on a ``ProjectDB``.

Design rules:
- **Names, not UUIDs.** The LLM works in natural language; we resolve
  step / phase names case-insensitively. Ambiguity (multiple matches)
  is treated as "skip this op" -- never guess.
- **Safe by default.** ``remove_step`` only deletes ``not_started``
  steps; refuses to delete a step that has children, in_progress
  status or completed status.
- **Idempotent enough.** Each operation returns a human-readable summary
  string; the route bundles them into the chat reply so the user can see
  exactly what changed.
- No DB transaction handling here -- the route owns the commit.
"""

from __future__ import annotations

from typing import Iterable

from app.agents.chat import PlanOperation
from app.db.models import PhaseDB, ProjectDB, StepDB
from app.schemas.enums import StepStatus, StepType


def _normalize(name: str) -> str:
    return name.strip().casefold()


def _find_phase(project: ProjectDB, name: str) -> PhaseDB | None:
    target = _normalize(name)
    matches = [p for p in project.phases if _normalize(p.name) == target]
    return matches[0] if len(matches) == 1 else None


def _find_step(
    project: ProjectDB, name: str
) -> tuple[PhaseDB, StepDB] | tuple[None, None]:
    """Return (phase, step) for the first unique step name match, else (None, None)."""
    target = _normalize(name)
    hits: list[tuple[PhaseDB, StepDB]] = []
    for phase in project.phases:
        for step in phase.steps:
            if _normalize(step.name) == target:
                hits.append((phase, step))
    if len(hits) == 1:
        return hits[0]
    return None, None


def _coerce_step_type(value: str) -> StepType:
    if not value:
        return StepType.other
    try:
        return StepType(value)
    except ValueError:
        return StepType.other


def _next_order(phase: PhaseDB) -> int:
    return 1 + max((s.order for s in phase.steps if s.parent_step_id is None), default=-1)


def apply_operations(
    project: ProjectDB, operations: Iterable[PlanOperation]
) -> list[str]:
    """Apply each operation in order. Return a list of human-readable summaries.

    Failed / skipped operations produce a summary starting with ``"skipped:"``
    so the caller can surface them to the user transparently.
    """
    summaries: list[str] = []

    for op in operations:
        try:
            summary = _apply_one(project, op)
        except Exception as exc:  # noqa: BLE001 - one bad op must not abort the rest
            summary = f"skipped: {op.op} failed ({exc})"
        summaries.append(summary)

    return summaries


def _apply_one(project: ProjectDB, op: PlanOperation) -> str:
    if op.op == "add_step":
        return _add_step(project, op)
    if op.op == "update_step":
        return _update_step(project, op)
    if op.op == "add_sub_steps":
        return _add_sub_steps(project, op)
    if op.op == "remove_step":
        return _remove_step(project, op)
    if op.op == "mark_replanned":
        return _mark_replanned(project, op)
    return f"skipped: unknown op '{op.op}'"


def _add_step(project: ProjectDB, op: PlanOperation) -> str:
    if not op.new_name.strip() or not op.new_objective.strip():
        return "skipped: add_step requires new_name and new_objective"

    phase: PhaseDB | None = None
    if op.phase_name:
        phase = _find_phase(project, op.phase_name)
    if phase is None and op.after_step_name:
        phase, _ = _find_step(project, op.after_step_name)
    if phase is None:
        return f"skipped: add_step could not locate phase '{op.phase_name}'"

    insert_order = _next_order(phase)
    if op.after_step_name:
        _, anchor = _find_step(project, op.after_step_name)
        if anchor is not None and anchor.parent_step_id is None:
            # Shift later steps in the same phase to free anchor.order + 1
            insert_order = anchor.order + 1
            for sib in phase.steps:
                if sib.parent_step_id is None and sib.order >= insert_order:
                    sib.order += 1

    new_step = StepDB(
        name=op.new_name.strip(),
        objective=op.new_objective.strip(),
        status=StepStatus.not_started.value,
        step_type=_coerce_step_type(op.new_step_type).value,
        order=insert_order,
    )
    phase.steps.append(new_step)
    return f"added '{new_step.name}' to phase '{phase.name}'"


def _update_step(project: ProjectDB, op: PlanOperation) -> str:
    if not op.step_name:
        return "skipped: update_step requires step_name"
    _, step = _find_step(project, op.step_name)
    if step is None:
        return f"skipped: no unique step named '{op.step_name}'"

    changed: list[str] = []
    if op.new_name.strip() and op.new_name.strip() != step.name:
        step.name = op.new_name.strip()
        changed.append("name")
    if op.new_objective.strip() and op.new_objective.strip() != step.objective:
        step.objective = op.new_objective.strip()
        changed.append("objective")
    if op.new_step_type:
        new_type = _coerce_step_type(op.new_step_type).value
        if new_type != step.step_type:
            step.step_type = new_type
            changed.append("type")
    if not changed:
        return f"skipped: update_step on '{op.step_name}' had nothing to change"
    # Surface any change visually with the replanned status.
    step.status = StepStatus.replanned.value
    return f"updated '{step.name}' ({', '.join(changed)})"


def _add_sub_steps(project: ProjectDB, op: PlanOperation) -> str:
    if not op.step_name:
        return "skipped: add_sub_steps requires step_name"
    if not op.sub_steps:
        return "skipped: add_sub_steps requires a non-empty sub_steps list"

    phase, parent = _find_step(project, op.step_name)
    if parent is None:
        return f"skipped: no unique step named '{op.step_name}'"

    base_order = max((c.order for c in parent.sub_steps), default=-1) + 1
    added = 0
    for spec in op.sub_steps[:5]:  # hard cap so the LLM cannot blow up the tree
        if not isinstance(spec, dict):
            continue
        name = str(spec.get("name", "")).strip()
        objective = str(spec.get("objective", "")).strip()
        if not name or not objective:
            continue
        child = StepDB(
            name=name,
            objective=objective,
            status=StepStatus.not_started.value,
            step_type=_coerce_step_type(str(spec.get("step_type", ""))).value,
            order=base_order + added,
            parent_step_id=parent.id,
        )
        phase.steps.append(child)  # same phase row owns sub_steps too
        added += 1

    if added == 0:
        return f"skipped: no valid sub_steps payload for '{op.step_name}'"
    return f"added {added} sub-step(s) under '{parent.name}'"


def _remove_step(project: ProjectDB, op: PlanOperation) -> str:
    if not op.step_name:
        return "skipped: remove_step requires step_name"
    phase, step = _find_step(project, op.step_name)
    if step is None:
        return f"skipped: no unique step named '{op.step_name}'"
    if step.status != StepStatus.not_started.value:
        return f"skipped: refusing to remove '{step.name}' (status={step.status})"
    if step.sub_steps:
        return f"skipped: '{step.name}' has sub-steps; remove them first"

    phase.steps.remove(step)
    return f"removed '{step.name}'"


def _mark_replanned(project: ProjectDB, op: PlanOperation) -> str:
    if not op.step_name:
        return "skipped: mark_replanned requires step_name"
    _, step = _find_step(project, op.step_name)
    if step is None:
        return f"skipped: no unique step named '{op.step_name}'"
    step.status = StepStatus.replanned.value
    return f"marked '{step.name}' as replanned"
