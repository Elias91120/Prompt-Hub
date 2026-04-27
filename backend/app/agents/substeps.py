"""Sub-steps generation agent.

Given a parent Step + its Project + Phase context, produces a small
list of concrete actionable sub-steps. Used to progressively refine
a high-level step ("Auth") into actionable units ("JWT", "Permissions",
"Middleware", "Tests") only when the user opens it (Écran 4).

No DB access. Pure generation.
"""

import json
import re

from pydantic import BaseModel, Field, ValidationError

from app.agents._model import get_model
from pydantic_ai import Agent

from app.schemas.enums import StepType
from app.schemas.phase import Phase
from app.schemas.project import Project
from app.schemas.step import Step

# ---------------------------------------------------------------------------
# Agent output schema
# ---------------------------------------------------------------------------


class SubStepDraft(BaseModel):
    """A single sub-step proposed by the agent."""

    name: str = Field(..., description="Short sub-step name shown on the card")
    objective: str = Field(..., description="One-line concrete objective")
    step_type: StepType = Field(..., description="Category: frontend, backend, infra, or other")


class SubStepsOutput(BaseModel):
    """Complete list of proposed sub-steps."""

    sub_steps: list[SubStepDraft] = Field(
        ..., min_length=2, max_length=6, description="Between 2 and 6 sub-steps"
    )


# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """\
You are a senior technical project manager breaking down a single
project step into 2-6 concrete sub-steps that the user can implement
one at a time with a coding AI (Copilot, Cursor, etc.).

Rules:
- Generate between 2 and 6 sub-steps. Fewer is better than padded.
- Each sub-step must be a small, actionable unit (1-3 hours of work).
- Sub-steps must collectively cover the parent step's objective —
  no more, no less.
- Stay strictly within the project's stated stack and constraints.
- Do NOT invent features outside the parent step's scope.
- Assign the correct step_type for each sub-step
  (frontend, backend, infra, other).
- Sub-step names should be short and concrete (e.g. "JWT token issuance",
  not "Auth implementation work").

You MUST respond with ONLY a JSON object (no markdown, no explanation)
matching this exact schema:
{
  "sub_steps": [
    {"name": "Sub-step name", "objective": "What it achieves", "step_type": "backend"}
  ]
}

Valid step_type values: "frontend", "backend", "infra", "other".
"""


# ---------------------------------------------------------------------------
# Agent definition
# ---------------------------------------------------------------------------

_MODEL = get_model()

substeps_agent: Agent[None, str] = Agent(
    _MODEL,
    output_type=str,
    system_prompt=_SYSTEM_PROMPT,
    retries=1,
    defer_model_check=True,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_JSON_BLOCK_RE = re.compile(r"```(?:json)?\s*(.*?)```", re.DOTALL)


def _extract_json(text: str) -> dict:
    """Extract JSON from LLM response (may be wrapped in markdown fences)."""
    # Try markdown code block first
    m = _JSON_BLOCK_RE.search(text)
    if m:
        try:
            return json.loads(m.group(1))
        except json.JSONDecodeError:
            pass
    # Try finding the outermost JSON object
    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end > start:
        try:
            return json.loads(text[start:end + 1])
        except json.JSONDecodeError:
            pass
    return json.loads(text)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def generate_sub_steps(
    project: Project,
    phase: Phase,
    parent_step: Step,
    instructions: str = "",
) -> list[SubStepDraft]:
    """Generate sub-steps for a parent step.

    Returns a list of SubStepDraft objects (no IDs, no order — caller
    is responsible for persistence and ordering).
    """
    user_prompt = (
        f"Project: {project.name}\n"
        f"Project objective: {project.objective}\n"
    )
    if project.constraints:
        user_prompt += f"Constraints: {project.constraints}\n"
    user_prompt += (
        f"\nCurrent phase: {phase.name}\n"
        f"\nParent step to break down:\n"
        f"  Name: {parent_step.name}\n"
        f"  Objective: {parent_step.objective}\n"
        f"  Type: {parent_step.step_type.value}\n"
    )
    if instructions.strip():
        user_prompt += f"\nAdditional instructions:\n{instructions.strip()}\n"

    result = await substeps_agent.run(user_prompt)
    try:
        parsed = _extract_json(result.output)
        output = SubStepsOutput.model_validate(parsed)
    except (json.JSONDecodeError, ValidationError):
        # Retry once with a stricter prompt
        result = await substeps_agent.run(
            user_prompt + "\nIMPORTANT: Reply with ONLY valid JSON, no text before or after."
        )
        parsed = _extract_json(result.output)
        output = SubStepsOutput.model_validate(parsed)
    return output.sub_steps
