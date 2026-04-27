"""Tests for the context_slice service."""

from uuid import uuid4

import pytest

from app.schemas.enums import StepStatus, StepType
from app.schemas.phase import Phase
from app.schemas.project import Project
from app.schemas.skill import ProjectSkill, SkillKind
from app.schemas.step import Step
from app.services.context_slice import build_context_slice


def _make_project() -> Project:
    """Two phases:
        Phase 0 (Setup):
            S0 (completed, backend)
            S1 (completed, infra)
        Phase 1 (Build):
            S2 (in_progress, backend)
                Sub2a (not_started, backend)
                Sub2b (not_started, backend)
            S3 (not_started, frontend)
    """
    sub2a = Step(name="Sub2a", objective="a", step_type=StepType.backend, order=0)
    sub2b = Step(name="Sub2b", objective="b", step_type=StepType.backend, order=1)
    s2 = Step(
        name="S2",
        objective="build api",
        step_type=StepType.backend,
        order=0,
        status=StepStatus.in_progress,
        sub_steps=[sub2a, sub2b],
    )
    # link sub-steps to parent (matches what routes do on persist)
    sub2a.parent_step_id = s2.id
    sub2b.parent_step_id = s2.id

    s3 = Step(name="S3", objective="ui", step_type=StepType.frontend, order=1)
    s0 = Step(
        name="S0",
        objective="init",
        step_type=StepType.backend,
        order=0,
        status=StepStatus.completed,
    )
    s1 = Step(
        name="S1",
        objective="ci",
        step_type=StepType.infra,
        order=1,
        status=StepStatus.completed,
    )
    p0 = Phase(name="Setup", order=0, steps=[s0, s1])
    p1 = Phase(name="Build", order=1, steps=[s2, s3])
    return Project(
        name="P", description="d", objective="o", stack="FastAPI", phases=[p0, p1]
    )


def test_slice_for_top_level_step_includes_phase_and_siblings():
    project = _make_project()
    target = project.phases[1].steps[0]  # S2
    slc = build_context_slice(project, target.id)

    assert slc.target_step.id == target.id
    assert slc.phase.name == "Build"
    assert slc.parent_step is None
    assert [s.name for s in slc.sibling_steps] == ["S3"]


def test_slice_completed_prerequisites_are_ordered_and_filtered():
    project = _make_project()
    target = project.phases[1].steps[0]  # S2
    slc = build_context_slice(project, target.id)

    # S0 + S1 are completed and live in an earlier phase → both prerequisites.
    names = [s.name for s in slc.completed_prerequisites]
    assert names == ["S0", "S1"]


def test_slice_for_substep_uses_parent_siblings_only():
    project = _make_project()
    s2 = project.phases[1].steps[0]
    sub2a = s2.sub_steps[0]
    slc = build_context_slice(project, sub2a.id)

    assert slc.parent_step is not None
    assert slc.parent_step.id == s2.id
    assert [s.name for s in slc.sibling_steps] == ["Sub2b"]
    # Top-level S3 is NOT a sibling of a sub-step
    assert "S3" not in [s.name for s in slc.sibling_steps]


def test_slice_filters_skills_by_step_type():
    project = _make_project()
    target = project.phases[1].steps[1]  # S3 (frontend)
    pid = project.id
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)
    skills = [
        ProjectSkill(
            id=uuid4(),
            project_id=pid,
            name="React conv",
            kind=SkillKind.convention,
            applies_to=StepType.frontend,
            content="x",
            created_at=now,
            updated_at=now,
        ),
        ProjectSkill(
            id=uuid4(),
            project_id=pid,
            name="DB pattern",
            kind=SkillKind.convention,
            applies_to=StepType.backend,
            content="x",
            created_at=now,
            updated_at=now,
        ),
        ProjectSkill(
            id=uuid4(),
            project_id=pid,
            name="Glossary",
            kind=SkillKind.glossary,
            applies_to=None,  # universal
            content="x",
            created_at=now,
            updated_at=now,
        ),
    ]
    slc = build_context_slice(project, target.id, skills=skills)
    names = {s.name for s in slc.applicable_skills}
    assert names == {"React conv", "Glossary"}


def test_slice_unknown_step_raises():
    project = _make_project()
    with pytest.raises(ValueError):
        build_context_slice(project, uuid4())
