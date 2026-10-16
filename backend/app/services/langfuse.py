from __future__ import annotations

import logging

from langfuse import Langfuse
from langfuse.callback import CallbackHandler

from app.config import settings

logger = logging.getLogger(__name__)


class LangfuseService:
    def __init__(self) -> None:
        self._client: Langfuse | None = None
        self._host: str | None = None
        self._disabled = False
        self._warned = False

    def client(self) -> Langfuse | None:
        if self._disabled:
            return None
        if not settings.langfuse_public_key or not settings.langfuse_secret_key:
            self._disabled = True
            return None
        if self._client is not None:
            return self._client
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
            self._client = client
            self._host = host
            return self._client
        self._disabled = True
        if not self._warned:
            self._warned = True
            logger.warning(
                "Langfuse rejected the API keys for LANGFUSE_HOST=%s.",
                host,
            )
        return None

    def host(self) -> str | None:
        return self._host

    def handler(self) -> CallbackHandler | None:
        if not self.client() or not self._host:
            return None
        return CallbackHandler(
            public_key=settings.langfuse_public_key,
            secret_key=settings.langfuse_secret_key,
            host=self._host,
        )


langfuse = LangfuseService()


def langfuse_client() -> Langfuse | None:
    return langfuse.client()


def langfuse_host() -> str | None:
    return langfuse.host()


def langfuse_handler() -> CallbackHandler | None:
    return langfuse.handler()
