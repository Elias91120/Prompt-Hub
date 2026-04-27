"""Feedback analysis agent.

Takes a Project, Phase, Step and the free-text feedback returned by
a coding AI, then produces a structured analysis: summary, done/not-done
items, and recommendations (e.g. sub-steps to create).

No DB access. No plan mutation. No code generation.
"""

import json
import re

from pydantic import BaseModel, Field
from pydantic_ai import Agent

from app.agents._model import get_model

from app.schemas.phase import Phase
from app.schemas.project import Project
from app.schemas.step import Step

# ---------------------------------------------------------------------------
# Agent output schema
# ---------------------------------------------------------------------------


class FeedbackItem(BaseModel):
    """A single item from the implementation feedback."""

    description: str = Field(..., description="What was done or not done")
    done: bool = Field(..., description="True if the item was completed, False otherwise")


class Recommendation(BaseModel):
    """A recommended follow-up action derived from the feedback."""

    action: str = Field(
        ...,
        description=("Concrete action to take (e.g. 'Create sub-step: add input validation')"),
    )
    reason: str = Field(
        ...,
        description="Why this action is recommended, based on the feedback.",
    )
    priority: str = Field(
        ...,
        description="Priority level: high, medium, or low.",
    )


class FeedbackAnalysis(BaseModel):
    """Structured analysis of implementation feedback."""

    summary: str = Field(
        ...,
        description=(
            "Factual 2-4 sentence summary of what the coding AI reported. "
            "No opinions — only what the feedback states."
        ),
    )
    items: list[FeedbackItem] = Field(
        ...,
        min_length=1,
        description="List of done / not-done items extracted from the feedback.",
    )
    recommendations: list[Recommendation] = Field(
        default_factory=list,
        description=(
            "Suggested next actions: sub-steps to create, issues to fix, "
            "or confirmations that the step is complete."
        ),
    )
    assumptions: list[str] = Field(
        default_factory=list,
        description=(
            "Any assumptions the analysis relies on. Must be explicitly stated — never implicit."
        ),
    )
    step_complete: bool = Field(
        ...,
        description=(
            "True if all requirements appear to be met based on the feedback. "
            "False if work remains."
        ),
    )
    prompt_revision: str | None = Field(
        default=None,
        description=(
            "Reviewer protocol (Squad-inspired): if the feedback reveals that "
            "the original prompt was unclear, incomplete, or misled the coding "
            "AI, propose a short reformulation hint here. Null when the prompt "
            "itself is fine and only the work needs follow-up. The reviewer "
            "agent (this one) MUST be different from the agent that produced "
            "the prompt; this field exists so the human can decide whether to "
            "regenerate the prompt before retrying."
        ),
    )


# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """\
You are a senior technical project manager analysing implementation feedback.

A coding AI (Copilot, Cursor, etc.) has attempted to implement a step
from a project plan. The user pastes the coding AI's response into
a text field. Your job is to analyse that feedback and produce a
structured report.

Rules:
- SUMMARY: factual, 2-4 sentences. Only state what the feedback says.
  Do NOT add opinions or guesses.
- ITEMS: extract every deliverable or change mentioned in the feedback.
  Mark each as done (true) or not done (false).
  Compare against the step's objective — flag missing items.
- RECOMMENDATIONS: suggest concrete follow-up actions.
  If work is incomplete, recommend sub-steps to create.
  If everything is done, say so and recommend marking the step complete.
  Each recommendation must have a clear reason and priority (high/medium/low).
- ASSUMPTIONS: if you infer anything not explicitly stated in the feedback,
  list it here. Zero assumptions is ideal.
- STEP_COMPLETE: true only if ALL expected deliverables appear done.
  When in doubt, set to false.
- PROMPT_REVISION: only set this if the feedback reveals that the ORIGINAL
  prompt itself was unclear, incomplete, or pushed the coder in the wrong
  direction. In that case, write ONE short sentence describing how the next
  prompt should be reformulated. Otherwise leave it null. Do NOT use this
  field to comment on the work itself — use recommendations for that.
- Do NOT invent information absent from the feedback.
- Do NOT generate code or suggest specific implementations.
- Write in English.

You MUST respond with ONLY a JSON object (no markdown, no explanation) matching
this exact schema:
{
  "summary": "Factual summary...",
  "items": [{"description": "What was done", "done": true}],
  "recommendations": [{"action": "Concrete action", "reason": "Why", "priority": "high"}],
  "assumptions": ["Any assumption"],
  "step_complete": false,
  "prompt_revision": null
}

Valid priority values: "high", "medium", "low".
"""

# ---------------------------------------------------------------------------
# Agent definition
# ---------------------------------------------------------------------------

_MODEL = get_model()

feedback_agent: Agent[None, str] = Agent(
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
    m = _JSON_BLOCK_RE.search(text)
    if m:
        return json.loads(m.group(1))
    return json.loads(text)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def _build_user_prompt(project: Project, phase: Phase, step: Step, feedback_text: str) -> str:
    """Assemble user-message with step context and raw feedback."""
    parts = [
        f"# Project: {project.name}",
        f"Objective: {project.objective}",
    ]
    if project.constraints:
        parts.append(f"Constraints: {project.constraints}")

    parts.append("")
    parts.append(f"# Phase {phase.order}: {phase.name}")
    parts.append(f"# Step (order {step.order}): {step.name}")
    parts.append(f"Step objective: {step.objective}")
    parts.append(f"Step type: {step.step_type.value}")

    parts.append("")
    parts.append("# Implementation feedback from coding AI")
    parts.append("---")
    parts.append(feedback_text.strip())
    parts.append("---")

    return "\n".join(parts)


async def analyse_feedback(
    project: Project, phase: Phase, step: Step, feedback_text: str
) -> FeedbackAnalysis:
    """Analyse implementation feedback for a step.

    Returns a structured FeedbackAnalysis.
    No DB interaction — the caller is responsible for persistence / state changes.
    """
    user_msg = _build_user_prompt(project, phase, step, feedback_text)
    result = await feedback_agent.run(user_msg)
    parsed = _extract_json(result.output)
    return FeedbackAnalysis.model_validate(parsed)
