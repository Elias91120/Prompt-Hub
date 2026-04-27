import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ProjectDB(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False)
    business_context: Mapped[str | None] = mapped_column(String, nullable=True)
    constraints: Mapped[str | None] = mapped_column(String, nullable=True)
    objective: Mapped[str] = mapped_column(String, nullable=False)
    stack: Mapped[str | None] = mapped_column(String, nullable=True)
    decisions_log: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utc_now, onupdate=_utc_now
    )

    phases: Mapped[list["PhaseDB"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="PhaseDB.order",
    )


class PhaseDB(Base):
    __tablename__ = "phases"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False)
    order: Mapped[int] = mapped_column(Integer, nullable=False)
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )

    project: Mapped["ProjectDB"] = relationship(back_populates="phases")
    steps: Mapped[list["StepDB"]] = relationship(
        back_populates="phase",
        cascade="all, delete-orphan",
        order_by="StepDB.order",
        foreign_keys="StepDB.phase_id",
    )


class StepDB(Base):
    __tablename__ = "steps"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False)
    objective: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="not_started")
    step_type: Mapped[str] = mapped_column(String, nullable=False, default="other")
    order: Mapped[int] = mapped_column(Integer, nullable=False)

    phase_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("phases.id", ondelete="CASCADE"), nullable=False
    )
    parent_step_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("steps.id", ondelete="CASCADE"), nullable=True
    )

    phase: Mapped["PhaseDB"] = relationship(back_populates="steps", foreign_keys=[phase_id])
    parent_step: Mapped["StepDB | None"] = relationship(
        back_populates="sub_steps", remote_side="StepDB.id"
    )
    sub_steps: Mapped[list["StepDB"]] = relationship(
        back_populates="parent_step",
        cascade="all, delete-orphan",
        order_by="StepDB.order",
    )
    feedback_entries: Mapped[list["FeedbackDB"]] = relationship(
        back_populates="step",
        cascade="all, delete-orphan",
        order_by="FeedbackDB.created_at.desc()",
    )


class ProjectEventDB(Base):
    """Append-only audit log entry for a project.

    Captures every meaningful action (plan generated, prompt generated,
    feedback applied, status changed, sub-steps generated, project edited).
    Read-only after creation — acts as the project timeline.
    """

    __tablename__ = "project_events"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    step_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("steps.id", ondelete="SET NULL"), nullable=True, index=True
    )
    event_type: Mapped[str] = mapped_column(String, nullable=False)
    source: Mapped[str] = mapped_column(String, nullable=False, default="manual")
    payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utc_now, index=True
    )


class ProjectSkillDB(Base):
    """Reusable per-project knowledge atom (convention, glossary entry,
    anti-pattern, stack detail). Injected as context into generated prompts.

    Markdown content. Versioned via the `version` integer (caller bumps it on edit).
    """

    __tablename__ = "project_skills"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    kind: Mapped[str] = mapped_column(String, nullable=False, default="convention")
    # Optional step_type filter — if set, skill is only injected when the
    # target step matches (e.g. only inject backend conventions for backend steps).
    applies_to: Mapped[str | None] = mapped_column(String, nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utc_now, onupdate=_utc_now
    )


class PromptHistoryDB(Base):
    """Persisted record of every generated implementation prompt.

    Lets the user inspect prior prompts per step, copy them again,
    and (later) compare prompts before/after edits.
    """

    __tablename__ = "prompt_history"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    step_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("steps.id", ondelete="CASCADE"), nullable=False, index=True
    )
    prompt_text: Mapped[str] = mapped_column(Text, nullable=False)
    # Snapshot of skill ids that were injected at generation time — useful
    # to explain *why* a prompt looks the way it does.
    skill_ids: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utc_now, index=True
    )


class FeedbackDB(Base):
    """Persisted feedback analysis tied to a step.

    Stores both the raw feedback text the user pasted and the structured
    analysis returned by the feedback agent. Acts as the project's
    long-term memory of code AI implementations.
    """

    __tablename__ = "feedback"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    step_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("steps.id", ondelete="CASCADE"), nullable=False
    )
    raw_feedback: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    analysis: Mapped[dict] = mapped_column(JSON, nullable=False)
    step_complete: Mapped[bool] = mapped_column(default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)

    step: Mapped["StepDB"] = relationship(back_populates="feedback_entries")


class ChatMessageDB(Base):
    """Persisted chat history per project.

    Lets the user resume a scoping/co-pilot conversation across sessions
    instead of restarting from scratch each time the page reloads.
    Optional ``step_id`` lets us thread messages around a specific step
    when the user clicked "Discuter de ce step".
    """

    __tablename__ = "chat_messages"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    step_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("steps.id", ondelete="CASCADE"), nullable=True, index=True
    )
    role: Mapped[str] = mapped_column(String, nullable=False)  # "user" | "agent"
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utc_now, index=True
    )
