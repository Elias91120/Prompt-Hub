"""Context-slice builder.

Squad-inspired: instead of feeding the entire project into every agent
(context splitting / crowding), we hand each agent a focused slice — the
parts of the plan that are actually relevant to the work item at hand.

This module is pure: in → in-memory Pydantic objects only, no DB access,
no LLM calls. Routes prepare the slice; agents consume it.

The slice intentionally excludes unrelated phases and unrelated sub-step
trees. It includes:

  * the target step (with its sub-steps)
  * its parent step, if the target is itself a sub-step
  * its containing phase
  * sibling steps in the same phase / under the same parent
  * the ordered chain of completed prerequisite steps in the project
  * project skills filtered by ``applies_to`` against the target step's type
  * project decisions log (kept whole — it is the project's persistent memory)
"""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.phase import Phase
from app.schemas.project import Project
from app.schemas.skill import ProjectSkill
from app.schemas.step import Step


class PhaseProgressSummary(BaseModel):
    """Compact, prompt-friendly view of a phase's completion state.

    Included in :class:`ContextSlice` so agents can see the *whole project's*
    progress without receiving the full nested phase/step graph (which would
    bloat the context window).
    """

    order: int
    name: str
    total_steps: int
    completed_steps: int
    is_target_phase: bool
    step_lines: list[str] = Field(
        default_factory=list,
        description=(
            "One line per top-level step in this phase, e.g. "
            "'[x] Step name' or '[ ] Step name (in_progress)'. "
            "Pre-formatted so agents can paste them directly into prompts."
        ),
    )


class ContextSlice(BaseModel):
    """Focused subset of a Project, scoped to a single target step."""

    project_id: UUID
    project_name: str
    project_description: str
    project_objective: str
    project_business_context: str | None = None
    project_constraints: str | None = None
    project_stack: str | None = None
    decisions_log: str | None = None

    phase: Phase
    target_step: Step
    parent_step: Step | None = None
    sibling_steps: list[Step] = Field(default_factory=list)
    completed_prerequisites: list[Step] = Field(
        default_factory=list,
        description=(
            "Top-level completed steps that came before the target's phase, "
            "plus completed top-level steps earlier in the same phase. "
            "Ordered by (phase.order, step.order)."
        ),
    )
    applicable_skills: list[ProjectSkill] = Field(default_factory=list)
    phase_progress: list[PhaseProgressSummary] = Field(
        default_factory=list,
        description=(
            "Compact progress overview across all phases, ordered by phase order."
        ),
    )


def _find(project: Project, step_id: UUID) -> tuple[Phase, Step, Step | None] | None:
    """Locate (phase, step, parent_step) for a given step id."""
    for phase in project.phases:
        for top in phase.steps:
            if top.id == step_id:
                return phase, top, None
            for sub in top.sub_steps:
                if sub.id == step_id:
                    return phase, sub, top
    return None


def _completed_prerequisites(project: Project, target_phase: Phase, target_step: Step) -> list[Step]:
    """Return completed top-level steps that are prerequisites of the target.

    Strategy: any completed top-level step in earlier phases, plus completed
    top-level steps in the same phase with a strictly lower ``order``. This
    matches the typical left-to-right flow shown in the UI.
    """
    out: list[Step] = []
    sorted_phases = sorted(project.phases, key=lambda p: p.order)
    for ph in sorted_phases:
        if ph.order > target_phase.order:
            break
        same_phase = ph.id == target_phase.id
        for s in sorted(ph.steps, key=lambda x: x.order):
            if s.parent_step_id is not None:
                continue
            if s.status.value != "completed":
                continue
            if same_phase and s.order >= target_step.order:
                continue
            out.append(s)
    return out


def _status_label(status: str) -> str:
    return {
        "not_started": "Todo",
        "in_progress": "In Progress",
        "completed": "Done",
        "replanned": "Replanned",
    }.get(status, status)


def _build_phase_progress(project: Project, target_phase: Phase) -> list[PhaseProgressSummary]:
    out: list[PhaseProgressSummary] = []
    for ph in sorted(project.phases, key=lambda p: p.order):
        top = [s for s in ph.steps if s.parent_step_id is None]
        done = [s for s in top if s.status.value == "completed"]
        lines: list[str] = []
        for s in sorted(top, key=lambda x: x.order):
            check = "[x]" if s.status.value == "completed" else "[ ]"
            note = (
                ""
                if s.status.value in ("not_started", "completed")
                else f" ({_status_label(s.status.value)})"
            )
            lines.append(f"{check} {s.name}{note}")
        out.append(
            PhaseProgressSummary(
                order=ph.order,
                name=ph.name,
                total_steps=len(top),
                completed_steps=len(done),
                is_target_phase=ph.id == target_phase.id,
                step_lines=lines,
            )
        )
    return out


def build_context_slice(
    project: Project,
    step_id: UUID,
    skills: list[ProjectSkill] | None = None,
) -> ContextSlice:
    """Build a focused context slice for a target step.

    Raises ``ValueError`` if ``step_id`` is not present in the project.
    """
    found = _find(project, step_id)
    if found is None:
        raise ValueError(f"Step {step_id} not found in project {project.id}")
    phase, target, parent = found

    if parent is not None:
        siblings = [s for s in parent.sub_steps if s.id != target.id]
    else:
        siblings = [
            s for s in phase.steps if s.parent_step_id is None and s.id != target.id
        ]

    relevant_skills: list[ProjectSkill] = []
    for sk in skills or []:
        if sk.applies_to is None or sk.applies_to == target.step_type:
            relevant_skills.append(sk)

    return ContextSlice(
        project_id=project.id,
        project_name=project.name,
        project_description=project.description,
        project_objective=project.objective,
        project_business_context=project.business_context,
        project_constraints=project.constraints,
        project_stack=project.stack,
        decisions_log=project.decisions_log,
        phase=phase,
        target_step=target,
        parent_step=parent,
        sibling_steps=sorted(siblings, key=lambda x: x.order),
        completed_prerequisites=_completed_prerequisites(project, phase, target),
        applicable_skills=relevant_skills,
        phase_progress=_build_phase_progress(project, phase),
    )
