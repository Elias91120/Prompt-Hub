"""Streaming variant of the chat agent.

Bypasses pydantic-ai to talk directly to the OpenAI-compatible endpoint
with ``stream=True`` so we can pipe tokens to the frontend as they are
produced. The full text is reconstructed at the end and parsed into the
existing ``ChatResponse`` schema -- the structured action dispatch path
in the route is unchanged.

We intentionally re-use the same system prompt and model settings as
the non-streaming agent so behaviour stays consistent.
"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator

from openai import AsyncOpenAI

from app.agents._model import (
    DEFAULT_BASE_URL,
    DEFAULT_MODEL,
    DEFAULT_SETTINGS,
    _resolve_api_key,
)
from app.agents.chat import _SYSTEM_PROMPT


_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(
            base_url=os.environ.get("PROMPTHUB_BASE_URL", DEFAULT_BASE_URL),
            api_key=_resolve_api_key(),
            timeout=DEFAULT_SETTINGS.get("timeout", 120),
        )
    return _client


async def stream_chat_with_agent(
    messages: list[dict[str, str]],
    project_context: str = "",
) -> AsyncIterator[str]:
    """Yield text chunks from the LLM as they are produced.

    The yielded strings concatenate into the full agent reply (a JSON
    document matching ``ChatResponse``). The caller is responsible for
    parsing the final string and dispatching any structured action.
    """
    parts: list[str] = []
    if project_context:
        parts.append(f"PROJECT CONTEXT:\n{project_context}\n")
    for msg in messages:
        role = "User" if msg["role"] == "user" else "Agent"
        parts.append(f"{role}: {msg['content']}")
    conversation = "\n".join(parts)
    user_prompt = (
        f"Here is the conversation so far:\n\n{conversation}\n\nRespond as the Agent."
    )

    client = _get_client()
    model_name = os.environ.get("PROMPTHUB_MODEL", DEFAULT_MODEL)

    stream = await client.chat.completions.create(
        model=model_name,
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        max_tokens=DEFAULT_SETTINGS.get("max_tokens", 2048),
        temperature=DEFAULT_SETTINGS.get("temperature", 0.2),
        stream=True,
    )

    async for chunk in stream:
        if not chunk.choices:
            continue
        delta = chunk.choices[0].delta
        token = getattr(delta, "content", None)
        if token:
            yield token
