"""Tiny latency harness for any OpenAI-compatible LLM server.

Runs N round-trips against ``/v1/chat/completions`` using the same model
the Prompt Hub agents use, and prints per-call total latency + a summary.
No project context, no DB — just raw chat completions, so the numbers
isolate the LLM serving layer.

Usage::

    python backend/scripts/bench_latency.py            # 5 calls, default prompt
    python backend/scripts/bench_latency.py -n 10      # 10 calls

Honours the same env vars as the agents:
``PROMPTHUB_BASE_URL``, ``PROMPTHUB_MODEL``, ``MISTRAL_API_KEY``.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import statistics
import time

import httpx

PROMPT = (
    "List three considerations for designing a fast LLM serving stack. "
    "Reply in three short bullet points."
)


async def one_call(client: httpx.AsyncClient, base_url: str, model: str, key: str) -> float:
    t0 = time.perf_counter()
    res = await client.post(
        f"{base_url.rstrip('/')}/chat/completions",
        json={
            "model": model,
            "messages": [{"role": "user", "content": PROMPT}],
            "max_tokens": 256,
            "temperature": 0.2,
        },
        headers={"Authorization": f"Bearer {key}"},
    )
    res.raise_for_status()
    return time.perf_counter() - t0


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("-n", "--num", type=int, default=5, help="number of calls")
    args = parser.parse_args()

    base_url = os.environ.get("PROMPTHUB_BASE_URL", "https://api.mistral.ai/v1")
    model = os.environ.get("PROMPTHUB_MODEL", "mistral-large-latest")
    key = os.environ.get("PROMPTHUB_API_KEY") or os.environ.get("MISTRAL_API_KEY", "")

    if not key:
        print("ERROR: Set MISTRAL_API_KEY in your environment.")
        return

    print(f"Target : {base_url}  model={model}  calls={args.num}")
    timings: list[float] = []
    async with httpx.AsyncClient(timeout=300) as client:
        for i in range(args.num):
            try:
                dt = await one_call(client, base_url, model, key)
            except Exception as exc:  # noqa: BLE001
                print(f"  [{i + 1}/{args.num}] ERROR: {exc}")
                return
            timings.append(dt)
            print(f"  [{i + 1}/{args.num}] {dt * 1000:7.0f} ms")

    print(
        f"\nSummary  min={min(timings) * 1000:.0f} ms  "
        f"median={statistics.median(timings) * 1000:.0f} ms  "
        f"mean={statistics.mean(timings) * 1000:.0f} ms  "
        f"max={max(timings) * 1000:.0f} ms"
    )


if __name__ == "__main__":
    asyncio.run(main())
