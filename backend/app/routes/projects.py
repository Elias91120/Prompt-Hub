import json
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel as _BaseModel
from sqlalchemy.orm import Session, joinedload

logger = logging.getLogger(__name__)

from app.agents import (  # noqa: E402
    analyse_feedback,
    chat_with_agent,
    generate_plan,
    generate_prompt,
    generate_sub_steps,
)
from app.agents.chat import ChatResponse  # noqa: E402
from app.agents.chat_stream import stream_chat_with_agent  # noqa: E402
from app.agents.feedback import FeedbackAnalysis  # noqa: E402
from app.agents.prompt import build_user_prompt_from_slice  # noqa: E402
from app.db import events as project_events  # noqa: E402
from app.db.models import (  # noqa: E402
    ChatMessageDB,
    FeedbackDB,
    PhaseDB,
    ProjectDB,
    ProjectEventDB,
    ProjectSkillDB,
    PromptHistoryDB,
    StepDB,
)
from app.db.session import get_db  # noqa: E402
from app.schemas import (  # noqa: E402
    Phase,
    Project,
    ProjectCreate,
    ProjectSkill,
    ProjectSkillCreate,
    Step,
    StepStatus,
    StepType,
)
from app.services.context_slice import build_context_slice  # noqa: E402
from app.services.plan_adapter import apply_operations  # noqa: E402
from app.services.plan_restore import restore_plan_from_snapshot  # noqa: E402

router = APIRouter(prefix="/projects", tags=["projects"])


# ---------------------------------------------------------------------------
# DB → Pydantic converters
# ---------------------------------------------------------------------------


def _step_from_db(row: StepDB) -> Step:
    return Step(
        id=row.id,
        name=row.name,
        objective=row.objective,
        status=StepStatus(row.status),
        step_type=StepType(row.step_type),
        order=row.order,
        parent_step_id=row.parent_step_id,
        sub_steps=[_step_from_db(s) for s in row.sub_steps],
    )


def _phase_from_db(row: PhaseDB) -> Phase:
    top_level_steps = [s for s in row.steps if s.parent_step_id is None]
    return Phase(
        id=row.id,
        name=row.name,
        order=row.order,
        steps=[_step_from_db(s) for s in top_level_steps],
    )


def _project_from_db(row: ProjectDB) -> Project:
    return Project(
        id=row.id,
        name=row.name,
        description=row.description,
        business_context=row.business_context,
        constraints=row.constraints,
        objective=row.objective,
        stack=row.stack,
        decisions_log=row.decisions_log,
        phases=[_phase_from_db(p) for p in row.phases],
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _load_project(db: Session, project_id: UUID) -> ProjectDB:
    """Load a project with all nested relationships eagerly."""
    row = (
        db.query(ProjectDB)
        .options(
            joinedload(ProjectDB.phases).joinedload(PhaseDB.steps).joinedload(StepDB.sub_steps)
        )
        .filter(ProjectDB.id == project_id)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return row


def _find_step(
    project: Project, step_id: UUID
) -> tuple[Phase, Step] | tuple[None, None]:
    """Recursively find a step by ID, searching sub-steps too."""

    def _search(steps: list[Step]) -> Step | None:
        for s in steps:
            if s.id == step_id:
                return s
            found = _search(s.sub_steps)
            if found:
                return found
        return None

    for phase in project.phases:
        found = _search(phase.steps)
        if found:
            return phase, found
    return None, None


class ProjectEventOut(_BaseModel):
    """Read model for a single audit-log event."""

    id: UUID
    project_id: UUID
    step_id: UUID | None
    event_type: str
    source: str
    payload: dict
    created_at: str

    @classmethod
    def from_row(cls, row: ProjectEventDB) -> "ProjectEventOut":
        return cls(
            id=row.id,
            project_id=row.project_id,
            step_id=row.step_id,
            event_type=row.event_type,
            source=row.source,
            payload=row.payload or {},
            created_at=row.created_at.isoformat(),
        )


def _skill_from_db(row: ProjectSkillDB) -> ProjectSkill:
    return ProjectSkill(
        id=row.id,
        project_id=row.project_id,
        name=row.name,
        kind=row.kind,
        applies_to=row.applies_to,
        content=row.content,
        version=row.version,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


_PLAN_STATUS_GLYPH = {
    StepStatus.not_started.value: "[ ]",
    StepStatus.in_progress.value: "[~]",
    StepStatus.completed.value: "[x]",
    StepStatus.replanned.value: "[!]",
}


def _render_plan_context(project: Project) -> str:
    """Render a compact textual snapshot of the current plan for the chat agent.

    Returns "" when no phases exist yet (initial scoping mode). Otherwise
    produces a tree the LLM can reason about, including which step the user
    is most likely working on right now.
    """
    if not project.phases:
        return ""

    lines: list[str] = ["CURRENT PLAN:"]
    in_progress: Step | None = None
    first_not_started: Step | None = None

    for phase in sorted(project.phases, key=lambda p: p.order):
        lines.append(f"- Phase: {phase.name}")
        for step in sorted(phase.steps, key=lambda s: s.order):
            glyph = _PLAN_STATUS_GLYPH.get(step.status.value, "[?]")
            lines.append(
                f"    {glyph} {step.name} ({step.step_type.value}) -- {step.objective}"
            )
            if step.status == StepStatus.in_progress and in_progress is None:
                in_progress = step
            if step.status == StepStatus.not_started and first_not_started is None:
                first_not_started = step
            for sub in sorted(step.sub_steps, key=lambda s: s.order):
                sub_glyph = _PLAN_STATUS_GLYPH.get(sub.status.value, "[?]")
                lines.append(f"        {sub_glyph} {sub.name} -- {sub.objective}")

    focus = in_progress or first_not_started
    if focus is not None:
        label = "CURRENT FOCUS (in_progress)" if in_progress else "NEXT UP (not_started)"
        lines.append(f"\n{label}: '{focus.name}' -- {focus.objective}")

    return "\n".join(lines)


def _load_skills(db: Session, project_id: UUID) -> list[ProjectSkill]:
    rows = (
        db.query(ProjectSkillDB)
        .filter(ProjectSkillDB.project_id == project_id)
        .order_by(ProjectSkillDB.name)
        .all()
    )
    return [_skill_from_db(r) for r in rows]


class PromptHistoryOut(_BaseModel):
    id: UUID
    project_id: UUID
    step_id: UUID
    prompt_text: str
    skill_ids: list[str]
    created_at: str

    @classmethod
    def from_row(cls, row: PromptHistoryDB) -> "PromptHistoryOut":
        return cls(
            id=row.id,
            project_id=row.project_id,
            step_id=row.step_id,
            prompt_text=row.prompt_text,
            skill_ids=list(row.skill_ids or []),
            created_at=row.created_at.isoformat(),
        )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/", response_model=Project, status_code=201)
def create_project(body: ProjectCreate, db: Session = Depends(get_db)) -> Project:
    row = ProjectDB(
        name=body.name,
        description=body.description,
        business_context=body.business_context,
        constraints=body.constraints,
        objective=body.objective,
        stack=body.stack,
        decisions_log=body.decisions_log,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    project_events.emit_event(
        db,
        project_id=row.id,
        event_type=project_events.PROJECT_CREATED,
        payload={"name": row.name},
    )
    db.commit()
    return _project_from_db(row)


@router.get("/", response_model=list[Project])
def list_projects(db: Session = Depends(get_db)) -> list[Project]:
    rows = (
        db.query(ProjectDB)
        .options(
            joinedload(ProjectDB.phases).joinedload(PhaseDB.steps).joinedload(StepDB.sub_steps)
        )
        .order_by(ProjectDB.updated_at.desc())
        .all()
    )
    # deduplicate rows caused by joinedload cartesian product
    seen: set[UUID] = set()
    unique: list[ProjectDB] = []
    for r in rows:
        if r.id not in seen:
            seen.add(r.id)
            unique.append(r)
    return [_project_from_db(r) for r in unique]


@router.get("/{project_id}", response_model=Project)
def get_project(project_id: UUID, db: Session = Depends(get_db)) -> Project:
    row = _load_project(db, project_id)
    return _project_from_db(row)


@router.put("/{project_id}", response_model=Project)
def update_project(project_id: UUID, body: ProjectCreate, db: Session = Depends(get_db)) -> Project:
    row = _load_project(db, project_id)
    row.name = body.name
    row.description = body.description
    row.business_context = body.business_context
    row.constraints = body.constraints
    row.objective = body.objective
    row.stack = body.stack
    row.decisions_log = body.decisions_log
    db.commit()
    db.refresh(row)
    project_events.emit_event(
        db,
        project_id=row.id,
        event_type=project_events.PROJECT_UPDATED,
        payload={"name": row.name},
    )
    db.commit()
    return _project_from_db(_load_project(db, project_id))


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: UUID, db: Session = Depends(get_db)) -> None:
    row = _load_project(db, project_id)
    db.delete(row)
    db.commit()


@router.get(
    "/{project_id}/events",
    response_model=list[ProjectEventOut],
    summary="List audit-log events for a project (most recent first)",
)
def list_project_events(
    project_id: UUID,
    step_id: UUID | None = None,
    limit: int = 200,
    db: Session = Depends(get_db),
) -> list[ProjectEventOut]:
    # Confirm project exists (404 if not)
    _load_project(db, project_id)
    q = db.query(ProjectEventDB).filter(ProjectEventDB.project_id == project_id)
    if step_id is not None:
        q = q.filter(ProjectEventDB.step_id == step_id)
    rows = q.order_by(ProjectEventDB.created_at.desc()).limit(min(limit, 1000)).all()
    return [ProjectEventOut.from_row(r) for r in rows]


@router.post(
    "/{project_id}/events/{event_id}/revert",
    response_model=Project,
    summary="Undo a previous plan adaptation by restoring its pre-mutation snapshot",
)
def revert_event(
    project_id: UUID,
    event_id: UUID,
    db: Session = Depends(get_db),
) -> Project:
    """Restore the plan to the snapshot captured just before ``event_id``.

    Currently only ``plan_adapted`` events are revertible. Each such event
    embeds the full ``Project.model_dump`` snapshot taken just before the
    surgical edits were applied. Reverting wipes the current plan and
    re-creates it from the snapshot (UUIDs preserved when possible).
    """
    project = _load_project(db, project_id)
    event = db.get(ProjectEventDB, event_id)
    if event is None or event.project_id != project_id:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.event_type != project_events.PLAN_ADAPTED:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot revert event of type '{event.event_type}'",
        )
    snapshot = (event.payload or {}).get("snapshot")
    if not isinstance(snapshot, dict):
        raise HTTPException(status_code=400, detail="Event has no usable snapshot")

    try:
        restore_plan_from_snapshot(project, snapshot)
        db.flush()
        project_events.emit_event(
            db,
            project_id=project_id,
            event_type=project_events.PLAN_REVERTED,
            source="user",
            payload={"reverted_event_id": str(event_id)},
        )
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Failed to revert event %s on project %s", event_id, project_id)
        raise HTTPException(status_code=500, detail="Revert failed")

    return _project_from_db(_load_project(db, project_id))


class GeneratePlanBody(_BaseModel):
    """Optional request body for plan generation."""

    instructions: str = ""


@router.post("/{project_id}/generate-plan", response_model=Project)
async def generate_project_plan(
    project_id: UUID,
    body: GeneratePlanBody | None = None,
    db: Session = Depends(get_db),
) -> Project:
    row = _load_project(db, project_id)

    # Build ProjectCreate from existing row for the agent
    project_input = ProjectCreate(
        name=row.name,
        description=row.description,
        business_context=row.business_context,
        constraints=row.constraints,
        objective=row.objective,
    )

    # Generate plan via AI agent (no DB access inside agent)
    instructions = body.instructions if body else ""
    try:
        phases = await generate_plan(project_input, instructions=instructions)
    except Exception:
        logger.exception("Plan generation failed for project %s", project_id)
        raise

    # Clear existing phases and persist new ones
    row.phases.clear()
    db.flush()

    for phase in phases:
        phase_db = PhaseDB(id=phase.id, name=phase.name, order=phase.order)
        for step in phase.steps:
            step_db = StepDB(
                id=step.id,
                name=step.name,
                objective=step.objective,
                status=step.status.value,
                step_type=step.step_type.value,
                order=step.order,
            )
            for sub in step.sub_steps:
                step_db.sub_steps.append(
                    StepDB(
                        id=sub.id,
                        name=sub.name,
                        objective=sub.objective,
                        status=sub.status.value,
                        step_type=sub.step_type.value,
                        order=sub.order,
                        phase_id=phase.id,
                    )
                )
            phase_db.steps.append(step_db)
        row.phases.append(phase_db)

    db.commit()
    project_events.emit_event(
        db,
        project_id=project_id,
        event_type=project_events.PLAN_GENERATED,
        source="plan_agent",
        payload={
            "phase_count": len(phases),
            "step_count": sum(len(p.steps) for p in phases),
            "instructions": instructions or None,
        },
    )
    db.commit()
    return _project_from_db(_load_project(db, project_id))


@router.post(
    "/{project_id}/steps/{step_id}/generate-prompt",
    response_model=dict,
    summary="Generate an implementation prompt for a step",
)
async def generate_step_prompt(
    project_id: UUID, step_id: UUID, db: Session = Depends(get_db)
) -> dict:
    row = _load_project(db, project_id)
    project = _project_from_db(row)

    target_phase, target_step = _find_step(project, step_id)
    if target_step is None or target_phase is None:
        raise HTTPException(status_code=404, detail="Step not found in project")

    skills = _load_skills(db, project_id)
    # Build the slice once: passed to the agent (so it consumes the focused
    # context directly) AND reused below for orchestration metadata.
    slice_ = build_context_slice(project, step_id, skills=skills)
    prompt_text, user_msg = await generate_prompt(slice_)

    # Persist prompt history with the snapshot of injected skill ids
    injected_ids = [sk.id for sk in slice_.applicable_skills]
    history_row = PromptHistoryDB(
        project_id=project_id,
        step_id=step_id,
        prompt_text=prompt_text,
        skill_ids=[str(i) for i in injected_ids],
    )
    db.add(history_row)

    project_events.emit_event(
        db,
        project_id=project_id,
        step_id=step_id,
        event_type=project_events.PROMPT_GENERATED,
        source="prompt_agent",
        payload={
            "step_name": target_step.name,
            "prompt_chars": len(prompt_text),
            "context_chars": len(user_msg),
            "injected_skill_count": len(injected_ids),
            "slice_scope": {
                "phase": slice_.phase.name,
                "parent_step": slice_.parent_step.name if slice_.parent_step else None,
                "sibling_count": len(slice_.sibling_steps),
                "completed_prerequisite_count": len(slice_.completed_prerequisites),
                "applicable_skill_count": len(slice_.applicable_skills),
            },
        },
    )
    db.commit()
    return {"prompt": prompt_text}


@router.get(
    "/{project_id}/steps/{step_id}/preview-prompt-context",
    response_model=dict,
    summary="Return the assembled context that would be sent to the prompt agent (no LLM call)",
)
def preview_prompt_context(
    project_id: UUID, step_id: UUID, db: Session = Depends(get_db)
) -> dict:
    row = _load_project(db, project_id)
    project = _project_from_db(row)

    target_phase, target_step = _find_step(project, step_id)
    if target_step is None or target_phase is None:
        raise HTTPException(status_code=404, detail="Step not found in project")

    skills = _load_skills(db, project_id)
    slice_ = build_context_slice(project, step_id, skills=skills)

    return {"context": build_user_prompt_from_slice(slice_)}


class FeedbackBody(_BaseModel):
    """Request body for the feedback analysis endpoint."""

    feedback_text: str


def _find_step_db(db: Session, project_id: UUID, step_id: UUID) -> StepDB:
    """Locate a StepDB row that belongs to the given project."""
    row = (
        db.query(StepDB)
        .join(PhaseDB, StepDB.phase_id == PhaseDB.id)
        .filter(StepDB.id == step_id, PhaseDB.project_id == project_id)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Step not found in project")
    return row


@router.post(
    "/{project_id}/steps/{step_id}/analyse-feedback",
    response_model=FeedbackAnalysis,
    summary="Analyse implementation feedback for a step (preview only, no DB write)",
)
async def analyse_step_feedback(
    project_id: UUID,
    step_id: UUID,
    body: FeedbackBody,
    db: Session = Depends(get_db),
) -> FeedbackAnalysis:
    row = _load_project(db, project_id)
    project = _project_from_db(row)

    target_phase, target_step = _find_step(project, step_id)
    if target_step is None or target_phase is None:
        raise HTTPException(status_code=404, detail="Step not found in project")

    return await analyse_feedback(project, target_phase, target_step, body.feedback_text)


class ApplyFeedbackResponse(_BaseModel):
    """Response from applying feedback: persisted analysis + updated step status."""

    analysis: FeedbackAnalysis
    new_status: str
    project: Project


@router.post(
    "/{project_id}/steps/{step_id}/apply-feedback",
    response_model=ApplyFeedbackResponse,
    summary="Analyse + persist feedback and auto-update the step status",
)
async def apply_step_feedback(
    project_id: UUID,
    step_id: UUID,
    body: FeedbackBody,
    db: Session = Depends(get_db),
) -> ApplyFeedbackResponse:
    """Run feedback analysis, save it to the feedback memory table,
    and transition the step status:
      - step_complete=True  → status becomes "completed"
      - step_complete=False → status becomes "in_progress" (work remaining)
    """
    row = _load_project(db, project_id)
    project = _project_from_db(row)

    target_phase, target_step = _find_step(project, step_id)
    if target_step is None or target_phase is None:
        raise HTTPException(status_code=404, detail="Step not found in project")

    analysis = await analyse_feedback(project, target_phase, target_step, body.feedback_text)

    # Persist feedback as long-term memory
    fb_row = FeedbackDB(
        step_id=step_id,
        raw_feedback=body.feedback_text,
        summary=analysis.summary,
        analysis=analysis.model_dump(mode="json"),
        step_complete=analysis.step_complete,
    )
    db.add(fb_row)

    # Auto-update step status
    step_row = _find_step_db(db, project_id, step_id)
    new_status = "completed" if analysis.step_complete else "in_progress"
    previous_status = step_row.status
    step_row.status = new_status

    project_events.emit_event(
        db,
        project_id=project_id,
        step_id=step_id,
        event_type=project_events.FEEDBACK_APPLIED,
        source="feedback_agent",
        payload={
            "step_name": step_row.name,
            "summary": analysis.summary,
            "step_complete": analysis.step_complete,
            "previous_status": previous_status,
            "new_status": new_status,
            "prompt_revision": analysis.prompt_revision,
        },
    )

    db.commit()

    refreshed = _project_from_db(_load_project(db, project_id))
    return ApplyFeedbackResponse(analysis=analysis, new_status=new_status, project=refreshed)


class StepStatusUpdate(_BaseModel):
    """Body for manual step status updates."""

    status: StepStatus


@router.patch(
    "/{project_id}/steps/{step_id}",
    response_model=Project,
    summary="Manually update a step's status",
)
def update_step_status(
    project_id: UUID,
    step_id: UUID,
    body: StepStatusUpdate,
    db: Session = Depends(get_db),
) -> Project:
    step_row = _find_step_db(db, project_id, step_id)
    previous_status = step_row.status
    step_row.status = body.status.value
    project_events.emit_event(
        db,
        project_id=project_id,
        step_id=step_id,
        event_type=project_events.STEP_STATUS_CHANGED,
        payload={
            "step_name": step_row.name,
            "previous_status": previous_status,
            "new_status": body.status.value,
        },
    )
    db.commit()
    return _project_from_db(_load_project(db, project_id))


class GenerateSubStepsBody(_BaseModel):
    """Optional instructions for sub-step generation."""

    instructions: str = ""


@router.post(
    "/{project_id}/steps/{step_id}/generate-sub-steps",
    response_model=Project,
    summary="Generate sub-steps for a parent step (Écran 4)",
)
async def generate_step_sub_steps(
    project_id: UUID,
    step_id: UUID,
    body: GenerateSubStepsBody | None = None,
    db: Session = Depends(get_db),
) -> Project:
    """Break a parent step down into 2-6 actionable sub-steps using the
    sub-steps agent. Existing sub-steps are replaced.
    """
    row = _load_project(db, project_id)
    project = _project_from_db(row)

    target_phase, target_step = _find_step(project, step_id)
    if target_step is None or target_phase is None:
        raise HTTPException(status_code=404, detail="Step not found in project")

    instructions = body.instructions if body else ""
    try:
        drafts = await generate_sub_steps(project, target_phase, target_step, instructions)
    except Exception:
        logger.exception("Sub-step generation failed for step %s", step_id)
        raise HTTPException(status_code=500, detail="Sub-step generation error")

    # Locate the parent StepDB row and replace its sub-steps
    parent_row = _find_step_db(db, project_id, step_id)
    parent_row.sub_steps.clear()
    db.flush()

    for idx, draft in enumerate(drafts):
        sub_row = StepDB(
            name=draft.name,
            objective=draft.objective,
            status="not_started",
            step_type=draft.step_type.value,
            order=idx,
            phase_id=parent_row.phase_id,
        )
        parent_row.sub_steps.append(sub_row)

    db.commit()
    project_events.emit_event(
        db,
        project_id=project_id,
        step_id=step_id,
        event_type=project_events.SUB_STEPS_GENERATED,
        source="substeps_agent",
        payload={
            "parent_step_name": parent_row.name,
            "sub_step_count": len(drafts),
            "sub_step_names": [d.name for d in drafts],
        },
    )
    db.commit()
    return _project_from_db(_load_project(db, project_id))


# ---------------------------------------------------------------------------
# Chat
# ---------------------------------------------------------------------------


class ChatMessageItem(_BaseModel):
    role: str  # "user" | "agent"
    content: str


class ChatBody(_BaseModel):
    message: str
    history: list[ChatMessageItem] = []
    # Optional: focus the conversation on a specific step. The backend
    # injects the step context into the prompt so the agent can reason
    # about it precisely ("Discuter de ce step" button on a card).
    focus_step_id: UUID | None = None


class ChatHistoryItem(_BaseModel):
    id: UUID
    role: str
    content: str
    step_id: UUID | None
    created_at: str

    @classmethod
    def from_row(cls, row: ChatMessageDB) -> "ChatHistoryItem":
        return cls(
            id=row.id,
            role=row.role,
            content=row.content,
            step_id=row.step_id,
            created_at=row.created_at.isoformat(),
        )


@router.get(
    "/{project_id}/chat/history",
    response_model=list[ChatHistoryItem],
    summary="List the persisted chat messages for a project",
)
def list_chat_history(
    project_id: UUID,
    limit: int = 200,
    db: Session = Depends(get_db),
) -> list[ChatHistoryItem]:
    _load_project(db, project_id)
    rows = (
        db.query(ChatMessageDB)
        .filter(ChatMessageDB.project_id == project_id)
        .order_by(ChatMessageDB.created_at.asc())
        .limit(max(1, min(limit, 1000)))
        .all()
    )
    return [ChatHistoryItem.from_row(r) for r in rows]


@router.delete(
    "/{project_id}/chat/history",
    status_code=204,
    summary="Wipe the persisted chat history for a project",
)
def clear_chat_history(project_id: UUID, db: Session = Depends(get_db)) -> None:
    _load_project(db, project_id)
    db.query(ChatMessageDB).filter(ChatMessageDB.project_id == project_id).delete()
    db.commit()


@router.post(
    "/{project_id}/chat",
    summary="Chat with the project scoping agent",
)
async def project_chat(
    project_id: UUID,
    body: ChatBody,
    db: Session = Depends(get_db),
) -> dict:
    # Load project for context
    row = _load_project(db, project_id)
    project = _project_from_db(row)

    # Build project context string
    project_context = f"Name: {project.name}\nDescription: {project.description}\nObjective: {project.objective}"
    if project.constraints:
        project_context += f"\nConstraints: {project.constraints}"
    if project.business_context:
        project_context += f"\nBusiness context: {project.business_context}"

    # Plan tree (empty string if no plan exists yet)
    plan_context = _render_plan_context(project)
    if plan_context:
        project_context = f"{project_context}\n\n{plan_context}"

    # Optional focus on a specific step ("Discuter de ce step" button).
    focus_id = body.focus_step_id
    if focus_id is not None:
        _, focused = _find_step(project, focus_id)
        if focused is not None:
            project_context += (
                f"\n\nUSER IS FOCUSED ON STEP: '{focused.name}' "
                f"(status={focused.status.value}, type={focused.step_type.value})\n"
                f"Objective: {focused.objective}"
            )

    # Build conversation
    messages = [{"role": m.role, "content": m.content} for m in body.history]
    messages.append({"role": "user", "content": body.message})

    # Persist the user message before calling the LLM so it survives crashes.
    # Skip the synthetic "Start" greeting that the frontend sends on mount
    # when there is no prior history -- it would clutter every reload.
    is_initial_greeting = body.message == "Start" and not body.history
    if not is_initial_greeting:
        db.add(
            ChatMessageDB(
                project_id=project_id,
                step_id=focus_id,
                role="user",
                content=body.message,
            )
        )
        db.commit()

    try:
        response = await chat_with_agent(messages, project_context=project_context)
    except Exception:
        logger.exception("Chat agent failed for project %s", project_id)
        raise HTTPException(status_code=500, detail="Chat agent error")

    # Persist the agent reply too.
    if not is_initial_greeting:
        db.add(
            ChatMessageDB(
                project_id=project_id,
                step_id=focus_id,
                role="agent",
                content=response.message,
            )
        )
        db.commit()

    payload: dict = {
        "reply": response.message,
        "ready_to_plan": response.ready_to_plan,
        "action": None,
        "project": None,
    }

    # Dispatch the proposed action, if any
    await _dispatch_chat_action(db, row, project_id, response, payload)

    return payload


@router.post(
    "/{project_id}/chat/stream",
    summary="Chat with the project scoping agent (Server-Sent Events)",
    response_class=StreamingResponse,
)
async def project_chat_stream(
    project_id: UUID,
    body: ChatBody,
    db: Session = Depends(get_db),
) -> StreamingResponse:
    """SSE variant of :func:`project_chat`.

    Frame format::

        event: token       # one per LLM chunk
        data: <text>

        event: done        # exactly one, at the end
        data: <json payload identical to POST /chat>

        event: error       # at most one (in lieu of done)
        data: <message>
    """
    from app.agents.chat import _extract_json  # local import: same module

    row = _load_project(db, project_id)
    project = _project_from_db(row)

    project_context = (
        f"Name: {project.name}\nDescription: {project.description}\nObjective: {project.objective}"
    )
    if project.constraints:
        project_context += f"\nConstraints: {project.constraints}"
    if project.business_context:
        project_context += f"\nBusiness context: {project.business_context}"

    plan_context = _render_plan_context(project)
    if plan_context:
        project_context = f"{project_context}\n\n{plan_context}"

    focus_id = body.focus_step_id
    if focus_id is not None:
        _, focused = _find_step(project, focus_id)
        if focused is not None:
            project_context += (
                f"\n\nUSER IS FOCUSED ON STEP: '{focused.name}' "
                f"(status={focused.status.value}, type={focused.step_type.value})\n"
                f"Objective: {focused.objective}"
            )

    messages = [{"role": m.role, "content": m.content} for m in body.history]
    messages.append({"role": "user", "content": body.message})

    is_initial_greeting = body.message == "Start" and not body.history
    if not is_initial_greeting:
        db.add(
            ChatMessageDB(
                project_id=project_id,
                step_id=focus_id,
                role="user",
                content=body.message,
            )
        )
        db.commit()

    def _sse(event: str, data: str) -> bytes:
        # Escape newlines: SSE separates frames on \n\n; multi-line data
        # would have to be split across `data:` lines per spec but we
        # keep it simple by JSON-encoding tokens (consumed verbatim by
        # the frontend).
        return f"event: {event}\ndata: {data}\n\n".encode("utf-8")

    async def event_stream():
        chunks: list[str] = []
        try:
            async for token in stream_chat_with_agent(
                messages, project_context=project_context
            ):
                chunks.append(token)
                # JSON-encode so newlines / quotes survive the SSE frame.
                yield _sse("token", json.dumps(token))

            full_text = "".join(chunks)
            try:
                parsed = _extract_json(full_text)
                response = ChatResponse.model_validate(parsed)
            except Exception:
                response = ChatResponse(
                    message=full_text, ready_to_plan=False, action=None
                )

            payload: dict = {
                "reply": response.message,
                "ready_to_plan": response.ready_to_plan,
                "action": None,
                "project": None,
            }
            await _dispatch_chat_action(db, row, project_id, response, payload)

            if not is_initial_greeting:
                db.add(
                    ChatMessageDB(
                        project_id=project_id,
                        step_id=focus_id,
                        role="agent",
                        content=response.message,
                    )
                )
                db.commit()

            yield _sse("done", json.dumps(payload))
        except Exception as exc:  # noqa: BLE001
            logger.exception("Streaming chat failed for project %s", project_id)
            yield _sse("error", json.dumps(str(exc)))

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        # Disable buffering on intermediate proxies (nginx, etc.) so the
        # tokens reach the browser in real time.
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


async def _dispatch_chat_action(
    db: Session,
    row: ProjectDB,
    project_id: UUID,
    response: "ChatResponse",
    payload: dict,
) -> None:
    """Apply the structured action proposed by the chat agent (if any).

    Mutates ``payload`` in place. Shared by the JSON and streaming chat
    endpoints so behaviour stays consistent.
    """
    if response.action is None:
        return

    action = response.action
    try:
        if action.type == "append_constraints" and action.text.strip():
            existing = (row.constraints or "").strip()
            addition = action.text.strip()
            row.constraints = f"{existing}\n{addition}".strip() if existing else addition
            db.commit()
            payload["action"] = "append_constraints"
            payload["project"] = _project_from_db(_load_project(db, project_id)).model_dump(
                mode="json"
            )

        elif action.type == "adapt_plan":
            # Snapshot the *current* plan BEFORE mutating so the user
            # can hit "Undo" if the adaptation isn't what they wanted.
            pre_snapshot = _project_from_db(row).model_dump(mode="json")

            # `regenerate_phase` calls the planner -> needs await, so we
            # peel those ops off and run them separately. Other ops stay
            # in the synchronous `apply_operations` pipeline.
            phase_ops = [op for op in action.operations if op.op == "regenerate_phase"]
            other_ops = [op for op in action.operations if op.op != "regenerate_phase"]

            summaries = apply_operations(row, other_ops)
            for op in phase_ops:
                summaries.extend(await _regenerate_phase(row, op))

            applied = [s for s in summaries if not s.startswith("skipped:")]
            if not applied:
                payload["action"] = None
                payload["adapt_summaries"] = summaries
            else:
                db.flush()
                event_row = project_events.emit_event(
                    db,
                    project_id=project_id,
                    event_type=project_events.PLAN_ADAPTED,
                    source="chat",
                    payload={
                        "summaries": summaries,
                        "snapshot": pre_snapshot,
                    },
                )
                db.commit()
                db.refresh(event_row)
                payload["action"] = "adapt_plan"
                payload["adapt_summaries"] = summaries
                payload["event_id"] = str(event_row.id)
                payload["project"] = _project_from_db(
                    _load_project(db, project_id)
                ).model_dump(mode="json")

        elif action.type == "regenerate_plan":
            project_input = ProjectCreate(
                name=row.name,
                description=row.description,
                business_context=row.business_context,
                constraints=row.constraints,
                objective=row.objective,
            )
            phases = await generate_plan(project_input, instructions=action.instructions)

            row.phases.clear()
            db.flush()
            for phase in phases:
                phase_db = PhaseDB(id=phase.id, name=phase.name, order=phase.order)
                for step in phase.steps:
                    step_db = StepDB(
                        id=step.id,
                        name=step.name,
                        objective=step.objective,
                        status=step.status.value,
                        step_type=step.step_type.value,
                        order=step.order,
                    )
                    for sub in step.sub_steps:
                        step_db.sub_steps.append(
                            StepDB(
                                id=sub.id,
                                name=sub.name,
                                objective=sub.objective,
                                status=sub.status.value,
                                step_type=sub.step_type.value,
                                order=sub.order,
                            )
                        )
                    phase_db.steps.append(step_db)
                row.phases.append(phase_db)
            db.commit()

            payload["action"] = "regenerate_plan"
            payload["project"] = _project_from_db(_load_project(db, project_id)).model_dump(
                mode="json"
            )
    except Exception:
        logger.exception("Failed to dispatch chat action %s", action.type)
        payload["action"] = None


async def _regenerate_phase(row: ProjectDB, op) -> list[str]:
    """Re-plan the steps of one phase. Returns one summary per new step
    so the existing flash + diff pipeline picks them up automatically.
    """
    from app.agents.chat import PlanOperation  # type: ignore  # noqa: F401
    from app.agents.plan import regenerate_phase_steps

    if not op.phase_name.strip():
        return ["skipped: regenerate_phase requires phase_name"]

    target_name = op.phase_name.strip().casefold()
    phase: PhaseDB | None = next(
        (p for p in row.phases if p.name.strip().casefold() == target_name), None
    )
    if phase is None:
        return [f"skipped: regenerate_phase could not find phase '{op.phase_name}'"]

    # Refuse to wipe a phase that has any non-not_started step -- the
    # user already invested in it. They should use update_step / add_step
    # instead.
    locked = [s for s in phase.steps if s.parent_step_id is None and s.status != "not_started"]
    if locked:
        names = ", ".join(f"'{s.name}'" for s in locked)
        return [
            f"skipped: phase '{phase.name}' has work in progress on {names} -- "
            "use update_step / add_step instead"
        ]

    project_input = ProjectCreate(
        name=row.name,
        description=row.description,
        business_context=row.business_context,
        constraints=row.constraints,
        objective=row.objective,
    )
    plan_tree = _render_plan_context(_project_from_db(row))

    new_steps = await regenerate_phase_steps(
        project=project_input,
        plan_tree=plan_tree,
        phase_name=phase.name,
        instructions=op.instructions or "",
    )

    # Replace this phase's steps wholesale. Cascade delete handles old rows.
    phase.steps.clear()
    for s in new_steps:
        phase.steps.append(
            StepDB(
                name=s.name,
                objective=s.objective,
                status=s.status.value,
                step_type=s.step_type.value,
                order=s.order,
            )
        )

    return [f"added '{s.name}' to phase '{phase.name}'" for s in new_steps]


# ---------------------------------------------------------------------------
# Project Skills (per-project knowledge atoms injected into prompts)
# ---------------------------------------------------------------------------


@router.get(
    "/{project_id}/skills",
    response_model=list[ProjectSkill],
    summary="List all skills for a project",
)
def list_skills(project_id: UUID, db: Session = Depends(get_db)) -> list[ProjectSkill]:
    _load_project(db, project_id)
    return _load_skills(db, project_id)


@router.post(
    "/{project_id}/skills",
    response_model=ProjectSkill,
    status_code=201,
    summary="Create a new project skill",
)
def create_skill(
    project_id: UUID,
    body: ProjectSkillCreate,
    db: Session = Depends(get_db),
) -> ProjectSkill:
    _load_project(db, project_id)
    row = ProjectSkillDB(
        project_id=project_id,
        name=body.name,
        kind=body.kind.value,
        applies_to=body.applies_to.value if body.applies_to else None,
        content=body.content,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _skill_from_db(row)


@router.put(
    "/{project_id}/skills/{skill_id}",
    response_model=ProjectSkill,
    summary="Update a project skill (bumps version)",
)
def update_skill(
    project_id: UUID,
    skill_id: UUID,
    body: ProjectSkillCreate,
    db: Session = Depends(get_db),
) -> ProjectSkill:
    row = (
        db.query(ProjectSkillDB)
        .filter(ProjectSkillDB.id == skill_id, ProjectSkillDB.project_id == project_id)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Skill not found")
    row.name = body.name
    row.kind = body.kind.value
    row.applies_to = body.applies_to.value if body.applies_to else None
    row.content = body.content
    row.version = row.version + 1
    db.commit()
    db.refresh(row)
    return _skill_from_db(row)


@router.delete(
    "/{project_id}/skills/{skill_id}",
    status_code=204,
    summary="Delete a project skill",
)
def delete_skill(
    project_id: UUID, skill_id: UUID, db: Session = Depends(get_db)
) -> None:
    row = (
        db.query(ProjectSkillDB)
        .filter(ProjectSkillDB.id == skill_id, ProjectSkillDB.project_id == project_id)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Skill not found")
    db.delete(row)
    db.commit()


# ---------------------------------------------------------------------------
# Prompt history
# ---------------------------------------------------------------------------


@router.get(
    "/{project_id}/steps/{step_id}/prompts",
    response_model=list[PromptHistoryOut],
    summary="List the prompt history for a step (most recent first)",
)
def list_step_prompts(
    project_id: UUID,
    step_id: UUID,
    limit: int = 20,
    db: Session = Depends(get_db),
) -> list[PromptHistoryOut]:
    _load_project(db, project_id)
    rows = (
        db.query(PromptHistoryDB)
        .filter(
            PromptHistoryDB.project_id == project_id,
            PromptHistoryDB.step_id == step_id,
        )
        .order_by(PromptHistoryDB.created_at.desc())
        .limit(min(limit, 100))
        .all()
    )
    return [PromptHistoryOut.from_row(r) for r in rows]


# ---------------------------------------------------------------------------
# Analysis (non-executive) — read-only, never mutates the project
# ---------------------------------------------------------------------------

from app.agents import (  # noqa: E402
    analyse_plan_consistency,
    detect_step_risks,
    recommend_next_step,
)
from app.agents.analyse import (  # noqa: E402
    NextStepRecommendation,
    PlanConsistencyReport,
    StepRiskReport,
)


@router.post(
    "/{project_id}/analyse/plan-consistency",
    response_model=PlanConsistencyReport,
    summary="Audit the plan for gaps, duplicates, ordering issues (read-only)",
)
async def analyse_plan_endpoint(
    project_id: UUID, db: Session = Depends(get_db)
) -> PlanConsistencyReport:
    row = _load_project(db, project_id)
    project = _project_from_db(row)
    if not project.phases:
        raise HTTPException(status_code=400, detail="Project has no plan to analyse")
    try:
        return await analyse_plan_consistency(project)
    except Exception:
        logger.exception("Plan consistency analysis failed for %s", project_id)
        raise HTTPException(status_code=500, detail="Plan consistency analysis error")


@router.post(
    "/{project_id}/analyse/next-step",
    response_model=NextStepRecommendation,
    summary="Recommend the next step to attack (read-only, advisory only)",
)
async def analyse_next_step_endpoint(
    project_id: UUID, db: Session = Depends(get_db)
) -> NextStepRecommendation:
    row = _load_project(db, project_id)
    project = _project_from_db(row)
    if not project.phases:
        raise HTTPException(status_code=400, detail="Project has no plan")
    try:
        return await recommend_next_step(project)
    except Exception:
        logger.exception("Next-step recommendation failed for %s", project_id)
        raise HTTPException(status_code=500, detail="Next-step recommendation error")


@router.post(
    "/{project_id}/steps/{step_id}/analyse/risks",
    response_model=StepRiskReport,
    summary="Identify risks for a single step (read-only)",
)
async def analyse_step_risks_endpoint(
    project_id: UUID, step_id: UUID, db: Session = Depends(get_db)
) -> StepRiskReport:
    row = _load_project(db, project_id)
    project = _project_from_db(row)
    target_phase, target_step = _find_step(project, step_id)
    if target_step is None or target_phase is None:
        raise HTTPException(status_code=404, detail="Step not found in project")
    try:
        return await detect_step_risks(project, target_phase, target_step)
    except Exception:
        logger.exception("Step risk detection failed for %s", step_id)
        raise HTTPException(status_code=500, detail="Step risk detection error")


# ---------------------------------------------------------------------------
# Project recap (read-only summary)
# ---------------------------------------------------------------------------

from app.agents import summarise_project  # noqa: E402
from app.agents.recap import ProjectRecap  # noqa: E402


@router.post(
    "/{project_id}/recap",
    response_model=ProjectRecap,
    summary="Generate a short factual recap of project state (read-only)",
)
async def project_recap_endpoint(
    project_id: UUID, db: Session = Depends(get_db)
) -> ProjectRecap:
    row = _load_project(db, project_id)
    project = _project_from_db(row)
    try:
        return await summarise_project(project)
    except Exception:
        logger.exception("Project recap failed for %s", project_id)
        raise HTTPException(status_code=500, detail="Project recap error")
