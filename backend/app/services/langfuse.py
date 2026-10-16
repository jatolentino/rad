from __future__ import annotations

import logging

from langfuse import Langfuse
from langfuse.callback import CallbackHandler

from app.config import settings

logger = logging.getLogger(__name__)

_langfuse: Langfuse | None = None
_langfuse_host: str | None = None
_langfuse_disabled = False
_langfuse_warned = False


def langfuse_client() -> Langfuse | None:
    global _langfuse, _langfuse_host, _langfuse_disabled, _langfuse_warned
    if _langfuse_disabled:
        return None
    if not settings.langfuse_public_key or not settings.langfuse_secret_key:
        _langfuse_disabled = True
        return None
    if _langfuse is not None:
        return _langfuse
    host = (settings.langfuse_host or "").rstrip("/")
    client = Langfuse(
        public_key=settings.langfuse_public_key,
        secret_key=settings.langfuse_secret_key,
        host=host,
    )
    try:
        ok = bool(client.auth_check())
    except Exception:
        ok = False
    if ok:
        _langfuse = client
        _langfuse_host = host
        return _langfuse
    _langfuse_disabled = True
    if not _langfuse_warned:
        _langfuse_warned = True
        logger.warning(
            "Langfuse rejected the API keys for LANGFUSE_HOST=%s.",
            host,
        )
    return None


def langfuse_host() -> str | None:
    return _langfuse_host


def langfuse_handler() -> CallbackHandler | None:
    if not langfuse_client() or not _langfuse_host:
        return None
    return CallbackHandler(
        public_key=settings.langfuse_public_key,
        secret_key=settings.langfuse_secret_key,
        host=_langfuse_host,
    )
