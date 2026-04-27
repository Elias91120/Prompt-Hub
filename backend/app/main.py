import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import init_db
from app.routes import agents_router, projects_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="Prompt Hub",
    version="0.2.0",
    description="AI-assisted project planning backend — powered by Mistral AI",
    lifespan=lifespan,
)

# ── CORS ─────────────────────────────────────────────────────────────────
# Allow all origins for now — tighten in production if needed.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects_router)
app.include_router(agents_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
