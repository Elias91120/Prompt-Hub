from uuid import UUID, uuid4

from pydantic import BaseModel, Field

from app.schemas.enums import StepStatus, StepType


class Step(BaseModel):
    """Actionable unit of work inside a phase.

    Maps to a card in the Kanban view.
    A step may have child sub-steps (generated dynamically).
    """

    id: UUID = Field(default_factory=uuid4)
    name: str = Field(..., min_length=1, description="Step name shown on the card")
    objective: str = Field(..., min_length=1, description="One-line objective")
    status: StepStatus = Field(default=StepStatus.not_started)
    step_type: StepType = Field(default=StepType.other, description="Badge type on the card")
    order: int = Field(..., ge=0, description="Position within the phase")
    parent_step_id: UUID | None = Field(
        default=None,
        description="If set, this step is a sub-step of the referenced parent",
    )
    sub_steps: list["Step"] = Field(
        default_factory=list,
        description="Dynamically generated sub-steps (Écran 4)",
    )
