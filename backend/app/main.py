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
# In production the frontend is served from Vercel on a different origin.
import os

_allowed_origins = os.environ.get(
    "CORS_ORIGINS",
    "http://localhost:6052,http://localhost:5173,http://127.0.0.1:6052",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects_router)
app.include_router(agents_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
