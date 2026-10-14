"""Centralized error handling.

The API always answers with FastAPI's standard error envelope so the
frontend can normalize it (frontend/lib/api-error.ts):

    { "detail": "<message>" }                        HTTPException
    { "detail": [{ "loc": ..., "msg": ..., ... }] }  request validation (422)
    { "detail": { "<field>": "<message>" } }         field-level errors

Unexpected exceptions are logged server-side and answered with a plain
500 — stack traces, paths and credentials never reach the client.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger("ticket_api")


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(status_code=500, content={"detail": "Internal server error."})
