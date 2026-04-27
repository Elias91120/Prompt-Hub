"""Tests for the slice-based prompt builder.

Verifies that build_user_prompt_from_slice produces a prompt that includes
all the structural sections, and that build_user_prompt(project, phase,
step, skills) (the legacy wrapper) returns the *exact same* string — proving
the refactor is non-breaking.
"""

from datetime import datetime, timezone
from uuid import uuid4

from app.agents.prompt import build_user_prompt, build_user_prompt_from_slice
from app.schemas.enums import StepStatus, StepType
from app.schemas.phase import Phase
from app.schemas.project import Project
from app.schemas.skill import ProjectSkill, SkillKind
from app.schemas.step import Step
from app.services.context_slice import build_context_slice


def _project() -> Project:
    s_done = Step(
        name="Bootstrap",
        objective="init repo",
        step_type=StepType.infra,
        order=0,
        status=StepStatus.completed,
    )
    s_target = Step(
        name="JWT auth",
        objective="implement token issuance",
        step_type=StepType.backend,
        order=0,
        status=StepStatus.in_progress,
    )
    s_sibling = Step(
        name="Permissions",
        objective="rbac",
        step_type=StepType.backend,
        order=1,
    )
    p0 = Phase(name="Setup", order=0, steps=[s_done])
    p1 = Phase(name="Auth", order=1, steps=[s_target, s_sibling])
    return Project(
        name="MyApp",
        description="Internal HR portal",
        objective="Ship a portal in Q3",
        business_context="Replaces legacy intranet",
        constraints="Must use FastAPI",
        stack="FastAPI + React",
        decisions_log="- Postgres for persistence",
        phases=[p0, p1],
    )


def test_slice_builder_includes_all_sections():
    project = _project()
    target = project.phases[1].steps[0]
    slice_ = build_context_slice(project, target.id)
    text = build_user_prompt_from_slice(slice_)

    # 1. Project identity
    assert "# Project: MyApp" in text
    assert "Description: Internal HR portal" in text
    assert "Final objective: Ship a portal in Q3" in text
    # 2. Stack/constraints/business context
    assert "Stack: FastAPI + React" in text
    assert "Business context: Replaces legacy intranet" in text
    assert "Project constraints: Must use FastAPI" in text
    # 3. Decisions log
    assert "Postgres for persistence" in text
    # 5. Project progress with target-phase marker
    assert "→ Phase 2 — Auth" in text
    assert "[x] Bootstrap" in text
    # 6. Goal ancestry
    assert "Step ⟶ JWT auth" in text
    # 7. Sibling
    assert "Permissions" in text
    # 8. Target step focus
    assert "# Target step: JWT auth" in text
    assert "Type: backend" in text


def test_legacy_wrapper_matches_slice_builder():
    """The (project, phase, step, skills) wrapper must produce the exact
    same output as the slice-based builder — proving the refactor is a
    pure rewrite, not a behaviour change."""
    project = _project()
    target_phase = project.phases[1]
    target = target_phase.steps[0]

    via_slice = build_user_prompt_from_slice(
        build_context_slice(project, target.id)
    )
    via_legacy = build_user_prompt(project, target_phase, target)
    assert via_slice == via_legacy


def test_slice_builder_filters_skills_by_step_type():
    project = _project()
    target = project.phases[1].steps[0]  # backend
    now = datetime.now(timezone.utc)
    skills = [
        ProjectSkill(
            id=uuid4(),
            project_id=project.id,
            name="API conv",
            kind=SkillKind.convention,
            applies_to=StepType.backend,
            content="use snake_case",
            created_at=now,
            updated_at=now,
        ),
        ProjectSkill(
            id=uuid4(),
            project_id=project.id,
            name="UI conv",
            kind=SkillKind.convention,
            applies_to=StepType.frontend,
            content="never reached",
            created_at=now,
            updated_at=now,
        ),
    ]
    slice_ = build_context_slice(project, target.id, skills=skills)
    text = build_user_prompt_from_slice(slice_)
    assert "API conv" in text
    assert "use snake_case" in text
    assert "UI conv" not in text
    assert "never reached" not in text


def test_slice_phase_progress_summary_is_populated():
    project = _project()
    target = project.phases[1].steps[0]
    slice_ = build_context_slice(project, target.id)
    assert len(slice_.phase_progress) == 2
    p0, p1 = slice_.phase_progress
    assert p0.name == "Setup"
    assert p0.completed_steps == 1
    assert p0.total_steps == 1
    assert p0.is_target_phase is False
    assert p1.name == "Auth"
    assert p1.completed_steps == 0
    assert p1.total_steps == 2
    assert p1.is_target_phase is True
    assert any("JWT auth" in line for line in p1.step_lines)
