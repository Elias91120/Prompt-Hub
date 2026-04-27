"""Unit tests for the shared LLM model factory.

No network. No real LLM calls. Confirms the env-var contract is honoured
and that the factory builds an OpenAI-compatible model pointed at the
configured base URL.
"""

from __future__ import annotations

import pytest

from app.agents import _model as model_module


@pytest.fixture(autouse=True)
def _clear_cache() -> None:
    model_module.get_model.cache_clear()
    yield
    model_module.get_model.cache_clear()


def test_defaults_target_mistral(monkeypatch: pytest.MonkeyPatch) -> None:
    """With no env vars set (except API key), the factory points at Mistral."""
    monkeypatch.delenv("PROMPTHUB_BASE_URL", raising=False)
    monkeypatch.delenv("PROMPTHUB_MODEL", raising=False)
    monkeypatch.delenv("PROMPTHUB_API_KEY", raising=False)
    monkeypatch.setenv("MISTRAL_API_KEY", "test-key-for-ci")

    model = model_module.get_model()

    assert model.model_name == "mistral-large-latest"
    assert "mistral.ai" in str(model.base_url)


def test_env_overrides_are_honoured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PROMPTHUB_BASE_URL", "http://example.invalid:9999/v1")
    monkeypatch.setenv("PROMPTHUB_MODEL", "custom-model")
    monkeypatch.setenv("PROMPTHUB_API_KEY", "custom-token")

    model = model_module.get_model()

    assert model.model_name == "custom-model"
    assert str(model.base_url).rstrip("/") == "http://example.invalid:9999/v1"


def test_factory_is_cached(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("PROMPTHUB_BASE_URL", raising=False)
    monkeypatch.delenv("PROMPTHUB_MODEL", raising=False)
    monkeypatch.setenv("MISTRAL_API_KEY", "test-key-for-ci")

    a = model_module.get_model()
    b = model_module.get_model()

    assert a is b


def test_missing_api_key_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    """Factory raises RuntimeError when no API key is set."""
    monkeypatch.delenv("PROMPTHUB_API_KEY", raising=False)
    monkeypatch.delenv("MISTRAL_API_KEY", raising=False)

    with pytest.raises(RuntimeError, match="No API key found"):
        model_module.get_model()
