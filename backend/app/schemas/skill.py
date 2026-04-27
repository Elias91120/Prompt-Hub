"""Pydantic schemas for the project skills (per-project knowledge atoms)."""

from datetime import datetime
from enum import Enum
from uuid import UUID, uuid4

from pydantic import BaseModel, Field

from app.schemas.enums import StepType


class SkillKind(str, Enum):
    convention = "convention"
    glossary = "glossary"
    antipattern = "antipattern"
    stack_detail = "stack_detail"
    other = "other"


class ProjectSkillCreate(BaseModel):
    """Input schema for creating or updating a project skill."""

    name: str = Field(..., min_length=1, description="Short skill name shown in the UI")
    kind: SkillKind = Field(default=SkillKind.convention)
    applies_to: StepType | None = Field(
        default=None,
        description=(
            "Optional step_type filter: if set, the skill is only injected "
            "into prompts whose target step matches this type."
        ),
    )
    content: str = Field(..., min_length=1, description="Markdown body")


class ProjectSkill(BaseModel):
    """Read schema for a project skill."""

    id: UUID = Field(default_factory=uuid4)
    project_id: UUID
    name: str
    kind: SkillKind
    applies_to: StepType | None = None
    content: str
    version: int = 1
    created_at: datetime
    updated_at: datetime
