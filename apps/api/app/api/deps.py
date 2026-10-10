from collections.abc import Iterator

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.errors import Forbidden, NotAuthenticated
from app.db.models import Role
from app.db.session import system_session, tenant_session
from app.services.auth import AuthContext, resolve_token

bearer_scheme = HTTPBearer(auto_error=False)


def get_system_db() -> Iterator[Session]:
    """Unrestricted session. Only for the authentication layer (login, token lookup)."""
    with system_session() as session:
        yield session


def get_credentials(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> HTTPAuthorizationCredentials:
    if credentials is None or not credentials.credentials:
        raise NotAuthenticated("authentication required")
    return credentials


def get_auth_context(
    credentials: HTTPAuthorizationCredentials = Depends(get_credentials),
    db: Session = Depends(get_system_db),
) -> AuthContext:
    ctx = resolve_token(db, credentials.credentials)
    db.commit()  # persists the sliding-expiry touch, if any
    return ctx


def get_tenant_db(ctx: AuthContext = Depends(get_auth_context)) -> Iterator[Session]:
    """Session limited to the caller's agency (ADR-0005/0008). Endpoints commit explicitly."""
    with tenant_session(ctx.agency_id) as session:
        yield session


def require_manager(ctx: AuthContext = Depends(get_auth_context)) -> AuthContext:
    if ctx.role is not Role.MANAGER:
        raise Forbidden("manager role required")
    return ctx
