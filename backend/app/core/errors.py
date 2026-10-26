"""Typed error codes and HTTP error helpers.

All user-facing error messages must:
- Be actionable.
- Not reveal internal paths, stack traces, or secrets.
"""
from __future__ import annotations

import uuid
from typing import Any, Dict, Optional

from fastapi import HTTPException
from fastapi.responses import JSONResponse


class ErrorCode:
    INVALID_ARCHIVE = "INVALID_ARCHIVE"
    UNSUPPORTED_PROJECT = "UNSUPPORTED_PROJECT"
    UPLOAD_LIMIT_EXCEEDED = "UPLOAD_LIMIT_EXCEEDED"
    EXTRACTED_SIZE_LIMIT_EXCEEDED = "EXTRACTED_SIZE_LIMIT_EXCEEDED"
    ARCHIVE_PATH_REJECTED = "ARCHIVE_PATH_REJECTED"
    PROJECT_NOT_FOUND = "PROJECT_NOT_FOUND"
    JOB_NOT_FOUND = "JOB_NOT_FOUND"
    INVALID_BUG_REPORT = "INVALID_BUG_REPORT"
    PROVIDER_AUTH_ERROR = "PROVIDER_AUTH_ERROR"
    PROVIDER_RATE_LIMIT = "PROVIDER_RATE_LIMIT"
    PROVIDER_TIMEOUT = "PROVIDER_TIMEOUT"
    MODEL_OUTPUT_INVALID = "MODEL_OUTPUT_INVALID"
    PATCH_REJECTED = "PATCH_REJECTED"
    PATCH_APPLY_FAILED = "PATCH_APPLY_FAILED"
    SANDBOX_UNAVAILABLE = "SANDBOX_UNAVAILABLE"
    SANDBOX_TIMEOUT = "SANDBOX_TIMEOUT"
    TESTS_FAILED = "TESTS_FAILED"
    NO_TESTS_DISCOVERED = "NO_TESTS_DISCOVERED"
    EXPORT_FAILED = "EXPORT_FAILED"
    RATE_LIMITED = "RATE_LIMITED"
    INTERNAL_ERROR = "INTERNAL_ERROR"


def make_error_response(
    status_code: int,
    code: str,
    message: str,
    details: Optional[Dict[str, Any]] = None,
) -> JSONResponse:
    body: Dict[str, Any] = {
        "error": {
            "code": code,
            "message": message,
            "request_id": str(uuid.uuid4()),
        }
    }
    if details:
        body["error"]["details"] = details
    return JSONResponse(status_code=status_code, content=body)


class ProofPatchError(Exception):
    """Internal exception that maps to a structured API error."""

    def __init__(
        self,
        code: str,
        message: str,
        http_status: int = 500,
        details: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.http_status = http_status
        self.details = details
