from datetime import datetime, timezone
from uuid import UUID, uuid4

from pydantic import BaseModel, Field

from app.schemas.phase import Phase


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ProjectCreate(BaseModel):
    """Input schema for creating a new project (Écran 1)."""

    name: str = Field(..., min_length=1, description="Project name")
    description: str = Field(..., min_length=1, description="Free-text description")
    business_context: str | None = Field(
        default=None,
        description="Optional business context",
    )
    constraints: str | None = Field(
        default=None,
        description="Imposed constraints (e.g. stack, security, Nokia)",
    )
    objective: str = Field(..., min_length=1, description="Final objective of the project")
    stack: str | None = Field(
        default=None,
        description="Optional tech stack tag, e.g. 'React + FastAPI'",
    )
    decisions_log: str | None = Field(
        default=None,
        description=(
            "Persistent free-form markdown of key technical decisions. "
            "Injected as context into every generated prompt."
        ),
    )


class Project(BaseModel):
    """Full project with its plan (phases → steps).

    This is the root entity and the single source of truth for a project's plan.
    """

    id: UUID = Field(default_factory=uuid4)
    name: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1)
    business_context: str | None = None
    constraints: str | None = None
    objective: str = Field(..., min_length=1)
    stack: str | None = None
    decisions_log: str | None = None
    owner_id: UUID | None = Field(
        default=None,
        description="Supabase auth.users.id of the owner (None for legacy/demo).",
    )
    is_demo: bool = Field(
        default=False,
        description="Public read-only demo project, listed for everyone.",
    )
    phases: list[Phase] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=_utc_now)
    updated_at: datetime = Field(default_factory=_utc_now)
