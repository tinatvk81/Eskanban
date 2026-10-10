from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.core import errors as e

_STATUS: dict[type[e.DomainError], int] = {
    e.InvalidInput: 422,
    e.WeakPassword: 422,
    e.SlugTaken: 409,
    e.EmailTaken: 409,
    e.PhoneTaken: 409,
    e.SeatLimitReached: 409,
    e.LastManager: 409,
    e.UserNotFound: 404,
    e.InvalidCredentials: 401,
    e.NotAuthenticated: 401,
    e.AccountLocked: 429,
    e.WrongPassword: 400,
    e.Forbidden: 403,
    e.ScopeRequired: 500,
}


def _status_for(exc: e.DomainError) -> int:
    for cls in type(exc).__mro__:
        if cls in _STATUS:
            return _STATUS[cls]
    return 400


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(e.DomainError)
    async def _domain_error(_: Request, exc: e.DomainError) -> JSONResponse:
        headers: dict[str, str] = {}
        if isinstance(exc, e.NotAuthenticated):
            headers["WWW-Authenticate"] = "Bearer"
        if isinstance(exc, e.AccountLocked):
            headers["Retry-After"] = str(exc.retry_after_seconds)
        return JSONResponse(
            status_code=_status_for(exc),
            content={"error": {"code": exc.code, "message": str(exc)}},
            headers=headers,
        )
