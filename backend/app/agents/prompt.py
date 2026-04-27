"""Implementation-prompt generation agent.

Takes a Project (global context), the current Phase, and the target Step,
then generates a structured implementation prompt ready to be copy-pasted
into Copilot / Cursor.

No DB access. No plan mutation. No code generation.
"""

import json
import re

from pydantic import BaseModel, Field
from pydantic_ai import Agent

from app.agents._model import get_model

from app.schemas.phase import Phase
from app.schemas.project import Project
from app.schemas.skill import ProjectSkill
from app.schemas.step import Step
from app.services.context_slice import ContextSlice, build_context_slice

# ---------------------------------------------------------------------------
# Agent output schema
# ---------------------------------------------------------------------------


class PromptOutput(BaseModel):
    """Structured implementation prompt returned by the agent."""

    title: str = Field(
        ...,
        description="Short title summarising the step (e.g. 'Implement CRUD endpoints')",
    )
    context: str = Field(
        ...,
        description=(
            "Paragraph giving the AI coder the project and phase context "
            "it needs to understand *why* this step exists."
        ),
    )
    objective: str = Field(
        ...,
        description="Clear statement of what must be achieved in this step.",
    )
    requirements: list[str] = Field(
        ...,
        min_length=1,
        description="Numbered list of concrete deliverables / acceptance criteria.",
    )
    constraints: list[str] = Field(
        ...,
        min_length=1,
        description=(
            "Technical constraints the coder must follow (stack, patterns, forbidden approaches)."
        ),
    )
    out_of_scope: list[str] = Field(
        default_factory=list,
        description="Things the coder must NOT do in this step.",
    )
    hints: list[str] = Field(
        default_factory=list,
        description="Optional implementation hints or best-practice reminders.",
    )


# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """\
You are a senior software architect writing implementation prompts
for coding AIs (GitHub Copilot, Cursor, etc.).

Your output will be copy-pasted verbatim into a coding AI's chat window.
It must be self-contained, precise, and immediately actionable.

Rules:
- Write in English.
- The CONTEXT section must summarise the project, current phase,
  and where this step sits in the overall plan.
- The OBJECTIVE must be a single clear sentence.
- REQUIREMENTS are concrete deliverables — not vague wishes.
  Each requirement should be verifiable.
- CONSTRAINTS must reflect the actual tech stack and project rules.
  Never invent constraints the user didn't mention.
- OUT_OF_SCOPE lists things the coder must explicitly avoid
  (features from later steps, premature optimisation, etc.).
- HINTS are optional — only add them if genuinely useful.
- Do NOT generate code. Do NOT suggest specific libraries unless
  they are already part of the stated stack.
- Favor clarity over verbosity. Every sentence must earn its place.

You MUST respond with ONLY a JSON object (no markdown, no explanation) matching
this exact schema:
{
  "title": "Step Title",
  "context": "Project and phase context paragraph",
  "objective": "Clear objective statement",
  "requirements": ["Requirement 1", "Requirement 2"],
  "constraints": ["Constraint 1", "Constraint 2"],
  "out_of_scope": ["Item 1"],
  "hints": ["Hint 1"]
}
"""

# ---------------------------------------------------------------------------
# Agent definition
# ---------------------------------------------------------------------------

_MODEL = get_model()

prompt_agent: Agent[None, str] = Agent(
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

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def _extract_json(text: str) -> dict:
    """Extract JSON from LLM response (may be wrapped in markdown fences)."""
    m = _JSON_BLOCK_RE.search(text)
    if m:
        return json.loads(m.group(1))
    return json.loads(text)


def _status_label(status: str) -> str:
    return {
        "not_started": "Todo",
        "in_progress": "In Progress",
        "completed": "Done",
        "replanned": "Replanned",
    }.get(status, status)


def build_user_prompt_from_slice(slice_: ContextSlice) -> str:
    """Assemble the user-message for the prompt agent from a ContextSlice.

    This is the canonical builder. It depends only on the slice — no Project,
    no Phase, no global state — which keeps the agent's input surface small,
    deterministic, and easy to test.

    Structure:
      1. Project identity (name, description, objective)
      2. Stack / constraints / business context
      3. Persistent decisions log (if any)
      4. Project skills (already filtered by applicability inside the slice)
      5. Project progress overview (built from slice.phase_progress)
      6. Goal ancestry chain (Project → Phase → [Parent step] → Target step)
      7. Sibling context (already pre-filtered inside the slice)
      8. Target step focus
    """
    target = slice_.target_step
    parent = slice_.parent_step
    is_sub_step = parent is not None

    parts: list[str] = []

    # ── 1. Project identity ──────────────────────────────────────────────
    parts.append(f"# Project: {slice_.project_name}")
    parts.append(f"Description: {slice_.project_description}")
    parts.append(f"Final objective: {slice_.project_objective}")

    # ── 2. Stack / constraints / business context ────────────────────────
    if slice_.project_stack:
        parts.append(f"Stack: {slice_.project_stack}")
    if slice_.project_business_context:
        parts.append(f"Business context: {slice_.project_business_context}")
    if slice_.project_constraints:
        parts.append(f"Project constraints: {slice_.project_constraints}")

    # ── 3. Persistent decisions log ──────────────────────────────────────
    if slice_.decisions_log and slice_.decisions_log.strip():
        parts.append("")
        parts.append("# Key technical decisions (persistent project memory)")
        parts.append(slice_.decisions_log.strip())

    # ── 4. Project skills (already filtered by applicability) ────────────
    if slice_.applicable_skills:
        parts.append("")
        parts.append("# Project skills (reusable conventions and anti-patterns)")
        for sk in slice_.applicable_skills:
            scope = f" [{sk.applies_to.value}]" if sk.applies_to else ""
            parts.append(f"## {sk.name}{scope}  —  ({sk.kind.value}, v{sk.version})")
            parts.append(sk.content.strip())

    # ── 5. Project progress overview ─────────────────────────────────────
    parts.append("")
    parts.append("# Project progress")
    for ph in slice_.phase_progress:
        marker = "→" if ph.is_target_phase else " "
        parts.append(
            f"{marker} Phase {ph.order + 1} — {ph.name} "
            f"({ph.completed_steps}/{ph.total_steps} done)"
        )
        for line in ph.step_lines:
            parts.append(f"    {line}")

    # ── 6. Goal ancestry chain ───────────────────────────────────────────
    parts.append("")
    parts.append("# Goal ancestry for this work item")
    parts.append(f"Project objective ⟶ {slice_.project_objective}")
    parts.append(f"Phase {slice_.phase.order + 1} ⟶ {slice_.phase.name}")
    if is_sub_step and parent is not None:
        parts.append(f"Parent step ⟶ {parent.name} — {parent.objective}")
        parts.append(f"Sub-step ⟶ {target.name}")
    else:
        parts.append(f"Step ⟶ {target.name}")

    # ── 7. Sibling context ───────────────────────────────────────────────
    if slice_.sibling_steps:
        parts.append("")
        if is_sub_step:
            parts.append("# Other sub-steps under the same parent")
        else:
            parts.append("# Other steps in this phase")
        for s in slice_.sibling_steps:
            check = "[x]" if s.status.value == "completed" else "[ ]"
            parts.append(f"  {check} {s.name} — {s.objective}")

    # ── 8. Target step focus ─────────────────────────────────────────────
    parts.append("")
    label = "Target sub-step" if is_sub_step else "Target step"
    parts.append(f"# {label}: {target.name}")
    parts.append(f"Type: {target.step_type.value}")
    parts.append(f"Current status: {_status_label(target.status.value)}")
    parts.append(f"Objective: {target.objective}")

    if not is_sub_step and target.sub_steps:
        parts.append("")
        parts.append("Existing sub-steps for this step:")
        for s in sorted(target.sub_steps, key=lambda x: x.order):
            check = "[x]" if s.status.value == "completed" else "[ ]"
            parts.append(f"  {check} {s.name} — {s.objective}")

    return "\n".join(parts)


def build_user_prompt(
    project: Project,
    phase: Phase,
    step: Step,
    skills: list[ProjectSkill] | None = None,
) -> str:
    """Backward-compatible wrapper that builds the slice internally.

    Prefer :func:`build_user_prompt_from_slice` in new code so the slice
    can be computed once by the route layer and reused for orchestration
    metadata (event payloads, debugging, etc.).
    """
    # ``phase`` is intentionally unused: the slice locates the phase from the
    # step id. Kept in the signature for backward compatibility with the
    # original (project, phase, step, skills) call site.
    del phase
    slice_ = build_context_slice(project, step.id, skills=skills)
    return build_user_prompt_from_slice(slice_)


# Backwards-compatible alias
_build_user_prompt = build_user_prompt


def _format_prompt_text(output: PromptOutput) -> str:
    """Render the structured output as a plain-text prompt ready for copy-paste."""
    lines: list[str] = []

    lines.append(f"# {output.title}")
    lines.append("")

    lines.append("## Context")
    lines.append(output.context)
    lines.append("")

    lines.append("## Objective")
    lines.append(output.objective)
    lines.append("")

    lines.append("## Requirements")
    for i, req in enumerate(output.requirements, 1):
        lines.append(f"{i}. {req}")
    lines.append("")

    lines.append("## Constraints")
    for c in output.constraints:
        lines.append(f"- {c}")
    lines.append("")

    if output.out_of_scope:
        lines.append("## Out of Scope")
        for item in output.out_of_scope:
            lines.append(f"- {item}")
        lines.append("")

    if output.hints:
        lines.append("## Hints")
        for h in output.hints:
            lines.append(f"- {h}")
        lines.append("")

    return "\n".join(lines)


async def generate_prompt(
    project_or_slice: Project | ContextSlice,
    phase: Phase | None = None,
    step: Step | None = None,
    skills: list[ProjectSkill] | None = None,
) -> tuple[str, str]:
    """Generate a copy-pasteable implementation prompt for a step.

    Two call styles are supported:

    1. Slice-based (preferred — Squad-style "context replication"):
           ``await generate_prompt(slice_)``
       The route layer builds the slice once and reuses it for orchestration
       metadata.

    2. Legacy (project, phase, step, skills): kept for backward compatibility.
       Internally builds the slice and delegates to (1).

    Returns ``(rendered_prompt, user_message_sent_to_llm)``. The user message
    is returned so the caller can persist or inspect the exact context used.
    No DB interaction — the caller is responsible for persistence.
    """
    if isinstance(project_or_slice, ContextSlice):
        slice_ = project_or_slice
    else:
        if step is None:
            raise TypeError(
                "generate_prompt(project, phase, step, skills) requires a Step"
            )
        # ``phase`` is unused — slice locates it from the step id. Kept in
        # the signature for backward compatibility.
        del phase
        slice_ = build_context_slice(project_or_slice, step.id, skills=skills)

    user_msg = build_user_prompt_from_slice(slice_)
    result = await prompt_agent.run(user_msg)
    parsed = _extract_json(result.output)
    output = PromptOutput.model_validate(parsed)
    return _format_prompt_text(output), user_msg
