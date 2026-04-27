"""Routes exposing agent metadata.

These endpoints describe the agents that participate in Prompt Hub
orchestration. They never trigger an LLM call — they only return the
charters so the UI (or an auditor) can answer "who is doing what".
"""

from fastapi import APIRouter, HTTPException

from app.agents.charters import AgentCharter, get_charter, list_charters

router = APIRouter(prefix="/agents", tags=["agents"])


@router.get("/", response_model=list[AgentCharter])
def list_agents() -> list[AgentCharter]:
    """Return the charters of all registered agents."""
    return list_charters()


@router.get("/{name}", response_model=AgentCharter)
def get_agent(name: str) -> AgentCharter:
    """Return the charter for a single agent by name."""
    charter = get_charter(name)
    if charter is None:
        raise HTTPException(status_code=404, detail=f"Unknown agent: {name}")
    return charter
