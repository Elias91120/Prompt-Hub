"""Agent charters — explicit identity, role and limits per agent.

Inspired by Squad's "charter + history" pattern: every agent has an
explicit, versioned, legible identity rather than implicit behaviour
hidden in a system prompt.

Charters are pure data. They are NOT loaded into LLM calls automatically
(that would silently change agent behaviour). They are exposed via the
API so the UI can show *who* is involved in any given orchestration
step, and so reviewers can audit each agent's stated boundaries.

Adding a new agent? Append its charter here AND keep its module's
docstring in sync.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

AgentKind = Literal["planner", "generator", "analyser", "router", "summariser"]


class AgentCharter(BaseModel):
    """Explicit identity card for a Prompt-Hub agent.

    Mirrors the Squad pattern of a per-agent charter file: a small,
    legible contract describing what the agent does, what it consumes,
    what it produces, and — critically — what it must NOT do.
    """

    name: str = Field(..., description="Stable agent identifier (matches its module name)")
    kind: AgentKind = Field(..., description="Broad category of agent")
    role: str = Field(..., description="One-sentence role description")
    purpose: str = Field(..., description="Why this agent exists, in one short paragraph")
    inputs: list[str] = Field(..., description="What the agent expects as input")
    outputs: list[str] = Field(..., description="What the agent returns")
    does_not: list[str] = Field(
        ...,
        description=(
            "Hard limits — actions the agent never performs. "
            "Used to keep responsibilities scoped and reviewable."
        ),
    )
    version: int = Field(default=1, description="Charter revision (bumped on intentional change)")


_CHARTERS: list[AgentCharter] = [
    AgentCharter(
        name="plan",
        kind="planner",
        role="Generate the initial project plan (phases → steps).",
        purpose=(
            "Turn a project description into a structured, realistic plan. "
            "Sets the source of truth that every other agent reads from."
        ),
        inputs=["ProjectCreate (name, description, objective, constraints)", "Optional free-text instructions"],
        outputs=["Ordered list of Phase objects with their initial Steps"],
        does_not=[
            "Generate sub-steps (delegated to the substeps agent)",
            "Write or modify code",
            "Persist anything (route layer owns DB writes)",
            "Invent features outside the stated objective",
        ],
    ),
    AgentCharter(
        name="substeps",
        kind="planner",
        role="Break a single step into 2–6 actionable sub-steps on demand.",
        purpose=(
            "Progressive disclosure: keep the initial plan light, refine "
            "a step into concrete sub-units only when the user opens it."
        ),
        inputs=["Project, Phase, parent Step", "Optional instructions"],
        outputs=["List of SubStepDraft (name, objective, step_type)"],
        does_not=[
            "Mutate the parent step",
            "Persist sub-steps",
            "Invent scope outside the parent step's objective",
        ],
    ),
    AgentCharter(
        name="prompt",
        kind="generator",
        role="Produce a copy-paste-ready implementation prompt for one step.",
        purpose=(
            "Translate a step (with its context) into a prompt the user "
            "pastes into Copilot/Cursor/Claude. The agent does not run code."
        ),
        inputs=["Project", "Phase", "target Step", "Applicable ProjectSkills"],
        outputs=["PromptOutput (title, context, objective, requirements, constraints, …)"],
        does_not=[
            "Generate code",
            "Recommend specific libraries outside the stated stack",
            "Mutate the plan",
        ],
    ),
    AgentCharter(
        name="feedback",
        kind="analyser",
        role="Analyse the coding-AI's free-text response after a step attempt.",
        purpose=(
            "Independent reviewer of the work produced from the prompt. "
            "Squad-inspired: the prompt's author (prompt agent) does not "
            "review its own output — feedback does."
        ),
        inputs=["Project", "Phase", "Step", "Free-text feedback pasted by the user"],
        outputs=[
            "FeedbackAnalysis (summary, done/not-done items, recommendations, "
            "assumptions, step_complete flag)",
        ],
        does_not=[
            "Mark the step complete by itself (route + human decide)",
            "Modify the prompt or the plan",
            "Invent facts not present in the feedback text",
        ],
    ),
    AgentCharter(
        name="analyse_consistency",
        kind="analyser",
        role="Audit the plan for gaps, duplicates, ordering and scope drift.",
        purpose=(
            "Surface structural issues so the human can decide what to do. "
            "Read-only — never rewrites the plan."
        ),
        inputs=["Project (with phases/steps)"],
        outputs=["PlanConsistencyReport (issues + overall_assessment)"],
        does_not=["Mutate the plan", "Invent issues to look thorough"],
    ),
    AgentCharter(
        name="analyse_next_step",
        kind="analyser",
        role="Recommend the single next step the user should attack.",
        purpose="Help the user prioritise without prescribing automated execution.",
        inputs=["Project (with current statuses)"],
        outputs=["NextStepRecommendation (step_name, reason, priority)"],
        does_not=["Recommend more than one step", "Skip or reorder steps in DB"],
    ),
    AgentCharter(
        name="analyse_risks",
        kind="analyser",
        role="Identify risks for a single step before implementation.",
        purpose="Pre-flight check — flag ambiguity, missing dependencies, scope creep.",
        inputs=["Project", "Phase", "Step"],
        outputs=["StepRiskReport (risks + overall)"],
        does_not=["Modify the step", "Generate code or prompts"],
    ),
    AgentCharter(
        name="recap",
        kind="summariser",
        role="Produce a short factual recap of where the project stands.",
        purpose="Give the user a fast, opinion-free read on current state.",
        inputs=["Project (with statuses, decisions_log)"],
        outputs=["ProjectRecap (where_we_are, what_was_done, what_remains, momentum)"],
        does_not=[
            "Recommend actions",
            "Invent steps or facts not in the plan",
        ],
    ),
    AgentCharter(
        name="chat",
        kind="router",
        role="Conversational scoping + light intent detection.",
        purpose=(
            "Help the user clarify scope quickly and, when they explicitly "
            "ask, propose a structured plan-mutation action for the backend "
            "to dispatch. Does not act on its own."
        ),
        inputs=["Conversation history", "Optional project context string"],
        outputs=[
            "ChatResponse (message, ready_to_plan, optional ChatAction)",
        ],
        does_not=[
            "Generate the plan itself",
            "Persist anything",
            "Propose actions the user did not clearly request",
        ],
    ),
]


def list_charters() -> list[AgentCharter]:
    """Return the charters of all registered agents."""
    return list(_CHARTERS)


def get_charter(name: str) -> AgentCharter | None:
    """Return the charter for a given agent name, or None if unknown."""
    for c in _CHARTERS:
        if c.name == name:
            return c
    return None
