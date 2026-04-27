"""Tests for the AgentCharter registry and the GET /agents endpoint."""

from fastapi.testclient import TestClient

from app.agents.charters import get_charter, list_charters
from app.main import app


def test_charters_registry_is_non_empty_and_unique():
    charters = list_charters()
    assert len(charters) >= 5
    names = [c.name for c in charters]
    assert len(names) == len(set(names)), "agent names must be unique"


def test_every_charter_declares_limits():
    for c in list_charters():
        assert c.role.strip()
        assert c.purpose.strip()
        assert c.inputs, f"{c.name} has no declared inputs"
        assert c.outputs, f"{c.name} has no declared outputs"
        assert c.does_not, f"{c.name} has no declared limits"


def test_known_agents_are_registered():
    expected = {
        "plan",
        "substeps",
        "prompt",
        "feedback",
        "analyse_consistency",
        "analyse_next_step",
        "analyse_risks",
        "recap",
        "chat",
    }
    names = {c.name for c in list_charters()}
    missing = expected - names
    assert not missing, f"missing charters: {missing}"


def test_get_charter_unknown_returns_none():
    assert get_charter("does-not-exist") is None


def test_list_agents_endpoint():
    with TestClient(app) as client:
        resp = client.get("/agents/")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert {c["name"] for c in data} >= {"plan", "prompt", "feedback"}
        for c in data:
            assert {"name", "kind", "role", "purpose", "inputs", "outputs", "does_not"} <= set(c)


def test_get_agent_by_name():
    with TestClient(app) as client:
        resp = client.get("/agents/feedback")
        assert resp.status_code == 200
        body = resp.json()
        assert body["name"] == "feedback"
        assert body["kind"] == "analyser"


def test_get_agent_unknown_returns_404():
    with TestClient(app) as client:
        resp = client.get("/agents/nope")
        assert resp.status_code == 404
