"""Database engine and session management.

Supports both SQLite (local development) and PostgreSQL (production via
Supabase or any other provider).  The connection is configured via the
``DATABASE_URL`` environment variable:

- **Not set** → falls back to a local SQLite file at ``backend/prompt_hub.db``
- **Set** → uses the provided connection string (e.g. ``postgresql://...``)
"""

from __future__ import annotations

import os
from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.db.base import Base

# ── Connection string ────────────────────────────────────────────────────
_DEFAULT_SQLITE = f"sqlite:///{Path(__file__).resolve().parent.parent.parent / 'prompt_hub.db'}"
_DATABASE_URL = os.environ.get("DATABASE_URL", _DEFAULT_SQLITE)

# Fix Render/Supabase URLs that start with "postgres://" (needed by SQLAlchemy 2.x)
if _DATABASE_URL.startswith("postgres://"):
    _DATABASE_URL = _DATABASE_URL.replace("postgres://", "postgresql://", 1)

_engine: Engine | None = None
_SessionLocal: sessionmaker[Session] | None = None


def get_engine() -> Engine:
    global _engine
    if _engine is None:
        connect_args = {}
        if _DATABASE_URL.startswith("sqlite"):
            connect_args["check_same_thread"] = False
        _engine = create_engine(_DATABASE_URL, echo=False, connect_args=connect_args)
    return _engine


def init_db() -> None:
    """Create all tables. Safe to call multiple times (CREATE IF NOT EXISTS)."""
    engine = get_engine()
    Base.metadata.create_all(bind=engine)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a DB session and closes it after the request."""
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)
    session = _SessionLocal()
    try:
        yield session
    finally:
        session.close()
