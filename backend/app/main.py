import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.db import init_db
from app.routes import agents_router, projects_router

logger = logging.getLogger(__name__)


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


# ── CORS via custom middleware ───────────────────────────────────────────
# Using a custom middleware instead of CORSMiddleware to guarantee CORS
# headers are present on ALL responses, including unhandled exceptions.

class CORSEverythingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Handle preflight
        if request.method == "OPTIONS":
            response = JSONResponse(content={}, status_code=200)
        else:
            try:
                response = await call_next(request)
            except Exception as exc:
                logger.error("Unhandled error on %s %s: %s", request.method, request.url.path, exc, exc_info=True)
                response = JSONResponse(
                    status_code=500,
                    content={"detail": f"{type(exc).__name__}: {exc}"},
                )

        # Add CORS headers to EVERY response
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "*"
        response.headers["Access-Control-Max-Age"] = "600"
        return response


app.add_middleware(CORSEverythingMiddleware)

app.include_router(projects_router)
app.include_router(agents_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
