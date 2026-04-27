from uuid import UUID, uuid4

from pydantic import BaseModel, Field

from app.schemas.step import Step


class Phase(BaseModel):
    """Logical grouping of steps. Corresponds to a column in the Kanban view."""

    id: UUID = Field(default_factory=uuid4)
    name: str = Field(..., min_length=1, description="Phase name (column header)")
    order: int = Field(..., ge=0, description="Position within the project plan")
    steps: list[Step] = Field(default_factory=list)
