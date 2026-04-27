"""Shared LLM model factory for all agents.

Provider-agnostic: any OpenAI-compatible HTTP endpoint works.  The default
target is the **Mistral AI** cloud API via its OpenAI-compatible gateway at
``https://api.mistral.ai/v1``.

Environment variables
---------------------
- ``PROMPTHUB_BASE_URL`` -- OpenAI-compatible base URL
  (default ``https://api.mistral.ai/v1``).
- ``PROMPTHUB_MODEL`` -- model name (default ``mistral-large-latest``).
- ``PROMPTHUB_API_KEY`` -- API key.  **Required** — set via your ``.env``
  file or environment.  Falls back to the ``MISTRAL_API_KEY`` env var for
  convenience.
"""

from __future__ import annotations

import os
from functools import lru_cache

from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider
from pydantic_ai.settings import ModelSettings

DEFAULT_BASE_URL = "https://api.mistral.ai/v1"
DEFAULT_MODEL = "mistral-large-latest"

# Mistral supports higher throughput than a local CPU model, so we can
# afford richer outputs.
DEFAULT_SETTINGS = ModelSettings(
    max_tokens=2048,
    temperature=0.2,
    timeout=120,
)


def _resolve_api_key() -> str:
    """Return the API key from env vars, raising early if missing."""
    key = (
        os.environ.get("PROMPTHUB_API_KEY")
        or os.environ.get("MISTRAL_API_KEY")
        or ""
    )
    if not key:
        raise RuntimeError(
            "No API key found.  Set MISTRAL_API_KEY (or PROMPTHUB_API_KEY) "
            "in your environment or .env file."
        )
    return key


@lru_cache(maxsize=1)
def get_model() -> OpenAIChatModel:
    """Return the cached OpenAI-compatible chat model used by every agent."""
    base_url = os.environ.get("PROMPTHUB_BASE_URL", DEFAULT_BASE_URL)
    model_name = os.environ.get("PROMPTHUB_MODEL", DEFAULT_MODEL)
    api_key = _resolve_api_key()
    provider = OpenAIProvider(base_url=base_url, api_key=api_key)
    return OpenAIChatModel(model_name, provider=provider)
