from enum import StrEnum


class StepStatus(StrEnum):
    """Status of a step, mapped to card colors in the Kanban view.

    ⚪ not_started → Gris
    🔵 in_progress → Bleu
    🟢 completed   → Vert
    🟠 replanned   → Orange (modifiée / re-planifiée)
    """

    not_started = "not_started"
    in_progress = "in_progress"
    completed = "completed"
    replanned = "replanned"


class StepType(StrEnum):
    """Type badge displayed on a step card."""

    frontend = "frontend"
    backend = "backend"
    infra = "infra"
    other = "other"
