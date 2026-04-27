"""Non-executive analysis agents.

These agents NEVER mutate the project. They produce warnings, suggestions
and recommendations that are surfaced to the user as annotations. The
human always decides whether to act on them.

Three capabilities:
  * analyse_plan_consistency  — finds gaps, duplicates, ordering issues
  * recommend_next_step       — suggests the most useful step to attack now
  * detect_step_risks         — identifies risks in a single step

Each function:
  - Reads project state via the regular Pydantic schemas
  - Calls the LLM with a tightly scoped JSON output schema
  - Returns a structured Pydantic object — the route is responsible for
    serialisation. No DB access. No code generation.
"""

import json
import re
from typing import Literal

from pydantic import BaseModel, Field, ValidationError
from pydantic_ai import Agent

from app.agents._model import get_model

from app.schemas.phase import Phase
from app.schemas.project import Project
from app.schemas.step import Step

# ---------------------------------------------------------------------------
# Output schemas
# ---------------------------------------------------------------------------

Severity = Literal["info", "warning", "critical"]


class PlanIssue(BaseModel):
    """A single issue found in the plan structure."""

    kind: Literal[
        "gap", "duplicate", "ordering", "missing_dependency", "scope_mismatch", "other"
    ] = Field(..., description="Category of the issue")
    severity: Severity = Field(..., description="info | warning | critical")
    title: str = Field(..., description="Short headline for the issue")
    detail: str = Field(..., description="One- or two-sentence explanation")
    affected_step_names: list[str] = Field(
        default_factory=list,
        description="Step names this issue concerns (may be empty for plan-wide issues)",
    )


class PlanConsistencyReport(BaseModel):
    """Result of the plan-consistency analysis."""

    issues: list[PlanIssue] = Field(default_factory=list)
    overall_assessment: str = Field(
        ...,
        description=(
            "One short sentence summarising plan health. "
            "Never prescriptive — only descriptive."
        ),
    )


class NextStepRecommendation(BaseModel):
    """Suggested next step to attack."""

    step_name: str = Field(..., description="Exact name of the recommended step")
    reason: str = Field(..., description="Why this step is the right one to attack now")
    priority: Literal["high", "medium", "low"] = Field(...)


class StepRisk(BaseModel):
    """A single risk identified for a step."""

    kind: Literal[
        "ambiguity", "missing_dependency", "scope_creep", "constraint_conflict", "other"
    ] = Field(...)
    severity: Severity = Field(...)
    description: str = Field(..., description="What the risk is and why it matters")
    mitigation: str = Field(..., description="A concrete mitigation suggestion")


class StepRiskReport(BaseModel):
    """Result of the per-step risk analysis."""

    risks: list[StepRisk] = Field(default_factory=list)
    overall: str = Field(..., description="One-sentence summary of step risk posture")


# ---------------------------------------------------------------------------
# JSON extraction helper (shared)
# ---------------------------------------------------------------------------

_JSON_BLOCK_RE = re.compile(r"```(?:json)?\s*(.*?)```", re.DOTALL)


def _extract_json(text: str) -> dict:
    m = _JSON_BLOCK_RE.search(text)
    if m:
        try:
            return json.loads(m.group(1))
        except json.JSONDecodeError:
            pass
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            pass
    return json.loads(text)


# ---------------------------------------------------------------------------
# Agents
# ---------------------------------------------------------------------------

_MODEL = get_model()


_CONSISTENCY_PROMPT = """\
You are a senior reviewer auditing a software project plan.
Your job is to identify structural issues — NOT to rewrite the plan.

You can flag:
- gaps           : an obvious task missing for the stated objective
- duplicates     : two steps that overlap significantly
- ordering       : a step that should come before/after another
- missing_dependency : a step depending on something not yet planned
- scope_mismatch : a step that drifts from the project's objective/constraints
- other          : anything else worth raising

Rules:
- Never invent issues to look thorough. If the plan is sound, return an
  empty issues list and say so in overall_assessment.
- Stay strictly within the stated objective and constraints.
- Reference steps by their EXACT name (case-sensitive).
- Severity:
    critical : blocks delivery
    warning  : likely to cause rework
    info     : worth noting, low impact
- Maximum 8 issues. Prefer signal over volume.

Reply with ONLY a JSON object matching:
{
  "issues": [
    {"kind": "gap", "severity": "warning", "title": "...", "detail": "...",
     "affected_step_names": ["Step A"]}
  ],
  "overall_assessment": "Short summary."
}
"""

consistency_agent: Agent[None, str] = Agent(
    _MODEL,
    output_type=str,
    system_prompt=_CONSISTENCY_PROMPT,
    retries=1,
    defer_model_check=True,
)


_NEXT_STEP_PROMPT = """\
You are a pragmatic project lead recommending which step the user should
attack next, based on current progress.

Rules:
- Recommend exactly ONE step.
- Prefer in_progress steps over not_started ones.
- Among not_started steps, prefer the one whose dependencies (earlier
  steps in the same phase) are completed.
- Never recommend a completed step.
- The step_name must match an EXACT name from the plan.
- Keep the reason to one short sentence. No fluff.

Reply with ONLY a JSON object:
{"step_name": "Exact step name", "reason": "...", "priority": "high"}
"""

next_step_agent: Agent[None, str] = Agent(
    _MODEL,
    output_type=str,
    system_prompt=_NEXT_STEP_PROMPT,
    retries=1,
    defer_model_check=True,
)


_RISK_PROMPT = """\
You are a senior engineer reviewing a single project step before
implementation begins.

For each risk you identify, classify it as:
- ambiguity            : objective is too vague to act on
- missing_dependency   : depends on something not done / not planned
- scope_creep          : step is bigger than it pretends
- constraint_conflict  : conflicts with stated project constraints
- other                : anything else

Rules:
- Maximum 5 risks. If the step is well-defined, return an empty list.
- Each risk must have a concrete, actionable mitigation.
- Stay grounded in what the user actually wrote. Do not invent context.
- Severity:
    critical : will likely block the step
    warning  : likely to cause rework
    info     : worth noting

Reply with ONLY a JSON object:
{
  "risks": [
    {"kind": "ambiguity", "severity": "warning",
     "description": "...", "mitigation": "..."}
  ],
  "overall": "Short summary."
}
"""

risk_agent: Agent[None, str] = Agent(
    _MODEL,
    output_type=str,
    system_prompt=_RISK_PROMPT,
    retries=1,
    defer_model_check=True,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _project_summary(project: Project) -> str:
    parts = [
        f"Project: {project.name}",
        f"Objective: {project.objective}",
    ]
    if project.constraints:
        parts.append(f"Constraints: {project.constraints}")
    if project.stack:
        parts.append(f"Stack: {project.stack}")
    return "\n".join(parts)


def _plan_summary(project: Project) -> str:
    lines: list[str] = []
    for ph in sorted(project.phases, key=lambda p: p.order):
        lines.append(f"\nPhase {ph.order + 1} — {ph.name}")
        for s in sorted(
            (x for x in ph.steps if x.parent_step_id is None), key=lambda x: x.order
        ):
            check = "[x]" if s.status == "completed" else "[ ]"
            lines.append(f"  {check} {s.name} ({s.step_type.value}) — {s.objective}")
            for sub in sorted(s.sub_steps, key=lambda x: x.order):
                sub_check = "[x]" if sub.status == "completed" else "[ ]"
                lines.append(
                    f"      {sub_check} {sub.name} ({sub.step_type.value}) — {sub.objective}"
                )
    return "\n".join(lines)


async def _run_strict(agent: Agent[None, str], user_msg: str, schema: type[BaseModel]):
    """Run an agent and validate output, retrying once on parse/validation errors."""
    result = await agent.run(user_msg)
    try:
        return schema.model_validate(_extract_json(result.output))
    except (json.JSONDecodeError, ValidationError):
        result = await agent.run(
            user_msg + "\nIMPORTANT: Reply with ONLY valid JSON, no text before or after."
        )
        return schema.model_validate(_extract_json(result.output))


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def analyse_plan_consistency(project: Project) -> PlanConsistencyReport:
    """Audit the project plan for structural issues. Read-only."""
    user_msg = (
        f"{_project_summary(project)}\n\n"
        f"# Plan to audit{_plan_summary(project)}"
    )
    return await _run_strict(consistency_agent, user_msg, PlanConsistencyReport)


async def recommend_next_step(project: Project) -> NextStepRecommendation:
    """Recommend the next step the user should attack. Read-only."""
    user_msg = (
        f"{_project_summary(project)}\n\n"
        f"# Current plan and progress{_plan_summary(project)}"
    )
    return await _run_strict(next_step_agent, user_msg, NextStepRecommendation)


async def detect_step_risks(
    project: Project, phase: Phase, step: Step
) -> StepRiskReport:
    """Identify risks for a single step. Read-only."""
    user_msg = (
        f"{_project_summary(project)}\n\n"
        f"Phase: {phase.name}\n\n"
        f"# Target step\n"
        f"Name: {step.name}\n"
        f"Type: {step.step_type.value}\n"
        f"Objective: {step.objective}\n"
        f"Status: {step.status.value}\n"
    )
    if step.sub_steps:
        user_msg += "\nExisting sub-steps:\n"
        for sub in sorted(step.sub_steps, key=lambda x: x.order):
            user_msg += f"  - {sub.name} — {sub.objective}\n"
    return await _run_strict(risk_agent, user_msg, StepRiskReport)
