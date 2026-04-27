"""Database engine and session management.

Supports both SQLite (local development) and PostgreSQL (production via
Supabase or any other provider).  The connection is configured via the
``DATABASE_URL`` environment variable or individual ``DB_*`` vars.
"""

from __future__ import annotations

import os
import logging
from collections.abc import Generator
from pathlib import Path
from urllib.parse import quote_plus

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.db.base import Base

logger = logging.getLogger(__name__)

# ── Connection string ────────────────────────────────────────────────────
_DEFAULT_SQLITE = f"sqlite:///{Path(__file__).resolve().parent.parent.parent / 'prompt_hub.db'}"


def _build_database_url() -> str:
    """Build the database URL from env vars."""
    # Individual vars (safest for special-char passwords)
    db_host = os.environ.get("DB_HOST", "")
    db_password = os.environ.get("DB_PASSWORD", "")
    if db_host and db_password:
        db_user = os.environ.get("DB_USER", "postgres")
        db_port = os.environ.get("DB_PORT", "5432")
        db_name = os.environ.get("DB_NAME", "postgres")
        url = f"postgresql://{db_user}:{quote_plus(db_password)}@{db_host}:{db_port}/{db_name}"
        logger.info("DB config: host=%s port=%s user=%s", db_host, db_port, db_user)
        return url

    raw = os.environ.get("DATABASE_URL", "").strip()
    if not raw:
        logger.info("No DATABASE_URL set — using local SQLite.")
        return _DEFAULT_SQLITE

    if raw.startswith("postgres://"):
        raw = raw.replace("postgres://", "postgresql://", 1)
    return raw


_DATABASE_URL = _build_database_url()
_engine: Engine | None = None
_SessionLocal: sessionmaker[Session] | None = None
_tables_created = False


def get_engine() -> Engine:
    global _engine
    if _engine is None:
        connect_args: dict = {}
        if _DATABASE_URL.startswith("sqlite"):
            connect_args["check_same_thread"] = False
        _engine = create_engine(
            _DATABASE_URL,
            echo=False,
            connect_args=connect_args,
            pool_pre_ping=True,       # verify connections are alive
            pool_recycle=300,          # recycle connections every 5 min
        )
    return _engine


def _ensure_tables() -> None:
    """Create tables if they haven't been created yet. Tolerates failures."""
    global _tables_created
    if _tables_created:
        return
    try:
        engine = get_engine()
        Base.metadata.create_all(bind=engine)
        _tables_created = True
        logger.info("Database tables ensured.")
    except Exception as exc:
        logger.warning("Could not create tables (will retry on next request): %s", exc)


def init_db() -> None:
    """Try to create all tables. If DB is unreachable, log and continue.

    This makes the app start even if the database is temporarily unavailable
    (e.g. Supabase pooler not yet registered after a project restore).
    Tables will be created on the first successful request.
    """
    try:
        engine = get_engine()
        # Quick connectivity check
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        _ensure_tables()
        logger.info("Database connected successfully.")
    except Exception as exc:
        logger.warning(
            "Database not reachable at startup (will retry lazily): %s", exc
        )


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a DB session and closes it after the request."""
    global _SessionLocal
    # Lazy table creation — retries if init_db() failed at startup
    _ensure_tables()
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)
    session = _SessionLocal()
    try:
        yield session
    finally:
        session.close()
