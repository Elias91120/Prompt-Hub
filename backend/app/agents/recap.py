"""Project recap agent — read-only.

Given a Project (with its phases, steps, and statuses), produce a short
factual recap: where we are, what was done, what remains. NEVER invents
work that isn't already in the plan. NEVER mutates state.
"""

import json

from pydantic import BaseModel, Field, ValidationError
from pydantic_ai import Agent

from app.agents._model import get_model
from app.agents.analyse import _extract_json  # reuse the 3-tier JSON extractor
from app.schemas.project import Project

_MODEL = get_model()


# ---------------------------------------------------------------------------
# Output schema
# ---------------------------------------------------------------------------


class ProjectRecap(BaseModel):
    """A short factual recap of where the project stands."""

    where_we_are: str = Field(
        ...,
        description=(
            "One or two sentences describing the current state of the project. "
            "Strictly factual — no opinion, no advice."
        ),
    )
    what_was_done: list[str] = Field(
        default_factory=list,
        description=(
            "Up to 5 short bullets summarising completed work. "
            "Reference step names from the plan. Empty list if nothing is done."
        ),
    )
    what_remains: list[str] = Field(
        default_factory=list,
        description=(
            "Up to 5 short bullets summarising what is still to do. "
            "Reference step names from the plan. Empty list if everything is done."
        ),
    )
    momentum: str = Field(
        ...,
        description=(
            "One short qualifier of momentum: e.g. 'just started', 'in progress', "
            "'mostly done', 'completed'. Derived strictly from step statuses."
        ),
    )


# ---------------------------------------------------------------------------
# Agent
# ---------------------------------------------------------------------------

_RECAP_PROMPT = """\
You are summarising the current state of a software project for its
owner. The owner already knows the project — they just want a short,
factual recap of where things stand.

Hard rules:
- NEVER invent work, steps, decisions or facts that are not in the plan.
- NEVER give advice, opinions or recommendations. Only describe what IS.
- Reference steps by their EXACT name (case-sensitive) when relevant.
- Keep each bullet to one short sentence.
- "what_was_done" must only mention steps with status = completed.
- "what_remains" must only mention steps with status != completed.
- If the plan is empty or nothing is done, say so plainly.

Reply with ONLY a JSON object:
{
  "where_we_are": "Short 1-2 sentence factual state.",
  "what_was_done": ["...", "..."],
  "what_remains": ["...", "..."],
  "momentum": "just started | in progress | mostly done | completed"
}
"""

recap_agent: Agent[None, str] = Agent(
    _MODEL,
    output_type=str,
    system_prompt=_RECAP_PROMPT,
    retries=1,
    defer_model_check=True,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _build_user_msg(project: Project) -> str:
    lines: list[str] = [
        f"Project: {project.name}",
        f"Objective: {project.objective}",
    ]
    if project.constraints:
        lines.append(f"Constraints: {project.constraints}")
    if project.stack:
        lines.append(f"Stack: {project.stack}")
    if project.decisions_log:
        lines.append(f"Decisions log: {project.decisions_log}")

    if not project.phases:
        lines.append("\nThe project has no plan yet.")
        return "\n".join(lines)

    lines.append("\n# Plan with current statuses")
    for ph in sorted(project.phases, key=lambda p: p.order):
        lines.append(f"\nPhase {ph.order + 1} — {ph.name}")
        for s in sorted(
            (x for x in ph.steps if x.parent_step_id is None), key=lambda x: x.order
        ):
            lines.append(
                f"  - [{s.status.value}] {s.name} ({s.step_type.value}) — {s.objective}"
            )
            for sub in sorted(s.sub_steps, key=lambda x: x.order):
                lines.append(
                    f"      - [{sub.status.value}] {sub.name} ({sub.step_type.value}) "
                    f"— {sub.objective}"
                )
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def summarise_project(project: Project) -> ProjectRecap:
    """Return a short factual recap of the project. Read-only."""
    user_msg = _build_user_msg(project)
    result = await recap_agent.run(user_msg)
    try:
        return ProjectRecap.model_validate(_extract_json(result.output))
    except (json.JSONDecodeError, ValidationError):
        result = await recap_agent.run(
            user_msg + "\nIMPORTANT: Reply with ONLY valid JSON, no text before or after."
        )
        return ProjectRecap.model_validate(_extract_json(result.output))
