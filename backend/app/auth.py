"""Supabase Auth — JWT verification for FastAPI.

Supabase Auth issues HS256-signed JWTs containing the user id (`sub`),
the email (`email`) and the audience claim `authenticated`.  The shared
secret used to verify the signature is exposed in the project Settings →
API → JWT Settings, and must be provided through the
``SUPABASE_JWT_SECRET`` environment variable.

Two FastAPI dependencies are exposed:

- :func:`get_current_user` — raises 401 if the request is unauthenticated
  or the token is invalid.  Use on every mutation endpoint.
- :func:`get_current_user_optional` — returns ``None`` for anonymous
  callers.  Use on read-only endpoints that also serve public demo data.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, Request, status

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class AuthUser:
    """Subset of the Supabase JWT payload exposed to route handlers."""

    id: UUID
    email: str | None


_JWT_ALGORITHM = "HS256"
_JWT_AUDIENCE = "authenticated"


def _jwt_secret() -> str:
    secret = os.environ.get("SUPABASE_JWT_SECRET", "").strip()
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Auth not configured: SUPABASE_JWT_SECRET is missing on the server.",
        )
    return secret


def _extract_bearer(request: Request) -> str | None:
    header = request.headers.get("authorization") or request.headers.get("Authorization")
    if not header:
        return None
    parts = header.split(None, 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    token = parts[1].strip()
    return token or None


def _decode(token: str) -> dict:
    try:
        return jwt.decode(
            token,
            _jwt_secret(),
            algorithms=[_JWT_ALGORITHM],
            audience=_JWT_AUDIENCE,
            options={"require": ["exp", "sub"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please sign in again.",
        ) from exc
    except jwt.InvalidAudienceError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token audience.",
        ) from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication token: {exc}",
        ) from exc


def _user_from_payload(payload: dict) -> AuthUser:
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is missing user id (sub).",
        )
    try:
        user_id = UUID(str(sub))
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token user id is not a valid UUID.",
        ) from exc
    email = payload.get("email")
    return AuthUser(id=user_id, email=email if isinstance(email, str) else None)


def get_current_user(request: Request) -> AuthUser:
    """FastAPI dependency: require a valid Supabase session."""
    token = _extract_bearer(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _user_from_payload(_decode(token))


def get_current_user_optional(request: Request) -> AuthUser | None:
    """FastAPI dependency: return the user if authenticated, else None.

    Tolerant on purpose so anonymous browsers can still read public demo
    projects.  Malformed tokens are logged and treated as anonymous.
    """
    token = _extract_bearer(request)
    if not token:
        return None
    try:
        return _user_from_payload(_decode(token))
    except HTTPException as exc:
        logger.info("Optional auth: ignoring invalid token (%s)", exc.detail)
        return None


CurrentUser = Depends(get_current_user)
CurrentUserOptional = Depends(get_current_user_optional)
