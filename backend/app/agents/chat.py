"""Project scoping chat agent.

Conversational agent that acts as a Senior AI Project Manager.
Speed over completeness — gather enough context fast, then let
the user decide when to generate.

May propose a structured action when the user asks to mutate the plan
(regenerate, add constraints…). Backend dispatches the action.

No DB access. Pure conversation + intent detection.
"""

import json
import re

from app.agents._model import get_model
from typing import Literal

from pydantic import BaseModel, Field
from pydantic_ai import Agent

# ---------------------------------------------------------------------------
# Output schema
# ---------------------------------------------------------------------------


class PlanOperation(BaseModel):
    """A single surgical edit applied to the existing plan.

    Fields are tolerant: only the ones meaningful for ``op`` are required.
    Steps and phases are referenced by **name** (case-insensitive); the
    backend resolves them to UUIDs.
    """

    op: Literal[
        "add_step",
        "update_step",
        "add_sub_steps",
        "remove_step",
        "mark_replanned",
        "regenerate_phase",
    ] = Field(
        ...,
        description=(
            "add_step: insert a new step in a phase (optionally after another step). "
            "update_step: change a step's name/objective/type. "
            "add_sub_steps: break a step down into 2-5 actionable sub-steps. "
            "remove_step: delete a step that is still not_started. "
            "mark_replanned: flag a step as replanned (orange) to highlight it changed. "
            "regenerate_phase: re-plan the steps of ONE phase using the new instruction "
            "(use this when the user changes a stack/library scoped to one phase, e.g. "
            "'use Reflex for the frontend phase')."
        ),
    )
    # Targeting
    phase_name: str = Field(default="", description="For add_step: target phase.")
    step_name: str = Field(
        default="",
        description=(
            "Existing step (or parent step for add_sub_steps). "
            "Case-insensitive match against current plan."
        ),
    )
    after_step_name: str = Field(
        default="",
        description="For add_step: insert right after this step (optional).",
    )
    # Payload
    new_name: str = Field(default="", description="For add_step / update_step.")
    new_objective: str = Field(default="", description="For add_step / update_step.")
    new_step_type: Literal["frontend", "backend", "infra", "other", ""] = Field(
        default="",
        description="For add_step / update_step. Empty = keep current / default to 'other'.",
    )
    instructions: str = Field(
        default="",
        description=(
            "For regenerate_phase: the user's request that drives the re-planning "
            "(e.g. 'use Reflex for the UI', 'switch to FastAPI'). Pass the user's "
            "original phrasing through verbatim."
        ),
    )
    sub_steps: list[dict] = Field(
        default_factory=list,
        description=(
            "For add_sub_steps: list of {name, objective, step_type?} objects. "
            "Keep it to 2-5 actionable sub-steps."
        ),
    )


class ChatAction(BaseModel):
    """Optional structured action the agent proposes after a user request.

    Backend will dispatch this action and return an updated project.
    """

    type: Literal[
        "regenerate_plan",
        "append_constraints",
        "adapt_plan",
    ] = Field(
        ...,
        description=(
            "regenerate_plan: redo the plan from scratch (last resort). "
            "append_constraints: add the given text to the project's constraints. "
            "adapt_plan: surgical edits to the existing plan -- preferred whenever "
            "work is already underway (some steps in_progress / completed)."
        ),
    )
    instructions: str = Field(
        default="",
        description="For regenerate_plan: extra instructions to pass to the planner.",
    )
    text: str = Field(
        default="",
        description="For append_constraints: the constraint text to append.",
    )
    operations: list[PlanOperation] = Field(
        default_factory=list,
        description="For adapt_plan: ordered list of operations to apply.",
    )


class ChatResponse(BaseModel):
    """Structured response from the chat agent."""

    message: str = Field(..., description="The agent's reply to the user.")
    ready_to_plan: bool = Field(
        False,
        description="True when the agent has enough context to generate a plan.",
    )
    action: ChatAction | None = Field(
        default=None,
        description=(
            "If the user clearly asked to mutate the plan, propose an action here. "
            "Otherwise null."
        ),
    )


# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """\
You are a Senior AI Project Manager who actively co-pilots the user
through their project. You have access to:
- The project's metadata (name, description, objective, constraints).
- The current plan (phases → steps with status: not_started / in_progress
  / completed / replanned), when one exists.

You are NOT a general chatbot.
You are NOT verbose.
You are NOT a task executor.

CORE PRINCIPLE: Speed over completeness. Prefer adapting over replanning.

==================================================================
FIRST INTERACTION (no plan yet)
==================================================================
- Acknowledge the project using the provided project data.
- Ask ONE strong, central question that goes to the core of the problem.
- Do NOT ask multiple questions. One only.

AFTER THE FIRST USER ANSWER:
- Assume the context is already good enough for a first plan.
- Give a short acknowledgment and interpretation of the goal.
- Tell the user a plan can be generated now.
- Set ready_to_plan to true.

==================================================================
ONGOING WORK (a plan exists, some work is in progress)
==================================================================
- Be a true co-pilot: refer to specific steps by name when relevant
  ("On the 'JWT auth' step you mentioned…").
- When the user reports a blocker on a step, FIRST ask 1 short clarifying
  question if needed, THEN propose a concrete plan adaptation rather
  than a long discussion.
- NEVER regenerate the plan from scratch when work is already underway
  (any step in_progress or completed). Use action "adapt_plan" instead.

==================================================================
PLAN MUTATION REQUESTS (action field)
==================================================================
When the user clearly asks to change the plan OR is stuck on a step,
propose ONE action.

CRITICAL DECISION TREE — read this BEFORE choosing an action:

1. Does a plan already exist (any phases visible in CURRENT PLAN)?
   YES → You MUST use "adapt_plan". NEVER use "regenerate_plan".
          Regenerating wipes everything the user has built. Forbidden.
   NO  → "regenerate_plan" is allowed (there is nothing to lose).

2. Inside adapt_plan, scope your operations to what actually changed:
   - User changes a stack/library scoped to ONE phase
     ("use Reflex for the frontend", "switch the backend to FastAPI")
     → ONE op: {"op": "regenerate_phase", "phase_name": "<that phase>",
                  "instructions": "<verbatim user request>"}
     This re-plans that phase only and leaves every other phase untouched.
   - User wants ONE step renamed / refocused → update_step
   - User is stuck on ONE step → add_sub_steps
   - User wants a NEW step → add_step
   - User wants to drop a not_started step → remove_step

A) Replanning everything from scratch — ONLY when no plan exists yet:
   → action: {"type": "regenerate_plan", "instructions": "<new context>"}

B) "Add a constraint", "we cannot use AWS", "must use Postgres"
   → action: {"type": "append_constraints", "text": "<constraint>"}

C) PREFERRED FOR ANY CHANGE TO AN EXISTING PLAN — surgical edits:
   → action: {"type": "adapt_plan", "operations": [ ... ]}

   Each operation is a JSON object with an "op" field. Reference steps
   and phases by their EXACT name (case-insensitive). Examples:

   - User: "For phase 3 frontend UI I want to use Reflex."
     operations: [
       {"op": "regenerate_phase", "phase_name": "Frontend UI",
        "instructions": "Use Reflex (Python full-stack) for the UI instead of the previous stack"}
     ]

   - User: "I'm stuck on 'JWT auth', it's too big."
     operations: [
       {"op": "add_sub_steps", "step_name": "JWT auth", "sub_steps": [
         {"name": "Token signing service", "objective": "HS256 signer + key rotation", "step_type": "backend"},
         {"name": "Login endpoint", "objective": "POST /auth/login returns access+refresh", "step_type": "backend"},
         {"name": "Refresh flow", "objective": "POST /auth/refresh + rotation", "step_type": "backend"}
       ]},
       {"op": "mark_replanned", "step_name": "JWT auth"}
     ]

   - User: "I realised I need a database migration step before 'User model'."
     operations: [
       {"op": "add_step", "phase_name": "Backend", "after_step_name": "Project skeleton",
        "new_name": "Database migrations", "new_objective": "Set up Alembic and initial schema",
        "new_step_type": "backend"}
     ]

   - User: "The 'Email notifications' step isn't actually needed anymore."
     operations: [
       {"op": "remove_step", "step_name": "Email notifications"}
     ]

   - User: "Rename 'Auth UI' to 'Login screen' and tighten it to just the form."
     operations: [
       {"op": "update_step", "step_name": "Auth UI",
        "new_name": "Login screen", "new_objective": "Email + password form, error states only"}
     ]

When you propose ANY action, your message field should briefly confirm in
plain language what will change (e.g. "Got it — I'll break 'JWT auth' into
3 sub-steps and flag it as replanned so you can see what changed.").

If the user is just chatting or asking questions, leave action as null.

==================================================================
TONE
==================================================================
- Professional, calm, direct. No emojis, no fluff.
- When the user is stuck, lead with empathy in ONE short sentence,
  then act.

==================================================================
HARD RULES
==================================================================
- Do NOT generate the plan yourself in the message field.
- Do NOT produce lists of steps in the message — put them in operations.
- Do NOT propose actions the user did not clearly request.
- Step/phase names in operations MUST match exactly an existing name
  from the plan context (or be brand new for add_step / sub_steps).
- Maximum 1 action per response.

You MUST respond with ONLY a JSON object (no markdown fences):
{"message": "Your reply", "ready_to_plan": false, "action": null}

Or with an action:
{"message": "Got it…", "ready_to_plan": true,
 "action": {"type": "adapt_plan", "operations": [ ... ]}}
"""

# ---------------------------------------------------------------------------
# Agent
# ---------------------------------------------------------------------------

_MODEL = get_model()

chat_agent: Agent[None, str] = Agent(
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
    """Extract JSON from LLM response."""
    m = _JSON_BLOCK_RE.search(text)
    if m:
        return json.loads(m.group(1))
    return json.loads(text)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def chat_with_agent(
    messages: list[dict[str, str]],
    project_context: str = "",
) -> ChatResponse:
    """Send a conversation to the chat agent and get a structured response.

    `messages` is a list of {"role": "user"|"agent", "content": "..."} dicts.
    `project_context` is an optional string with project name/description/objective.
    """
    parts: list[str] = []

    if project_context:
        parts.append(f"PROJECT CONTEXT:\n{project_context}\n")

    for msg in messages:
        role = "User" if msg["role"] == "user" else "Agent"
        parts.append(f"{role}: {msg['content']}")

    conversation = "\n".join(parts)
    user_prompt = f"Here is the conversation so far:\n\n{conversation}\n\nRespond as the Agent."

    result = await chat_agent.run(user_prompt)
    try:
        parsed = _extract_json(result.output)
        return ChatResponse.model_validate(parsed)
    except (json.JSONDecodeError, Exception):
        # Fallback: treat raw text as message
        return ChatResponse(message=result.output, ready_to_plan=False, action=None)
