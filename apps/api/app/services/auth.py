"""Authentication: login, session tokens, password changes.

Sessions are opaque random tokens; only their SHA-256 is stored, so a database leak does not leak
usable tokens, and a session can be revoked instantly (logout, password change, deactivation).

Note: failed-login bookkeeping is committed inside ``authenticate``/``change_password`` before the
error is raised, because the caller rolls back on exceptions and the counter must survive.
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import (
    AccountLocked,
    InvalidCredentials,
    InvalidInput,
    NotAuthenticated,
    ScopeRequired,
    UserNotFound,
    WrongPassword,
)
from app.core.phone import normalize_phone
from app.core.security import (
    TOKEN_PREFIX,
    burn_verification_time,
    generate_token,
    hash_password,
    hash_token,
    needs_rehash,
    validate_password,
    verify_password,
)
from app.db.models import Agency, AuthSession, Role, User
from app.db.tenancy import SYSTEM, get_scope

_TOUCH_INTERVAL = timedelta(minutes=5)  # avoid a database write on every request


@dataclass(frozen=True)
class AuthContext:
    user_id: uuid.UUID
    agency_id: uuid.UUID
    role: Role
    session_id: uuid.UUID
    must_change_password: bool


def _now() -> datetime:
    return datetime.now(UTC)


def _require_system(session: Session) -> None:
    if get_scope(session) is not SYSTEM:
        raise ScopeRequired("this operation needs a system session")


def _register_failure(session: Session, user: User, now: datetime) -> None:
    settings = get_settings()
    user.failed_login_attempts += 1
    if user.failed_login_attempts >= settings.max_failed_logins:
        user.locked_until = now + timedelta(minutes=settings.lockout_minutes)
        user.failed_login_attempts = 0
    session.commit()


def _check_not_locked(user: User, now: datetime) -> None:
    if user.locked_until is not None and user.locked_until > now:
        remaining = int((user.locked_until - now).total_seconds()) + 1
        raise AccountLocked("too many failed attempts, try again later", remaining)


def authenticate(
    session: Session,
    *,
    phone: str,
    password: str,
    ip: str | None = None,
    user_agent: str | None = None,
    now: datetime | None = None,
) -> tuple[str, AuthSession, User]:
    """Check credentials and open a session. Returns (raw_token, session_row, user)."""
    _require_system(session)
    now = now or _now()
    settings = get_settings()

    try:
        normalized = normalize_phone(phone)
    except InvalidInput:
        burn_verification_time(password)
        raise InvalidCredentials("invalid mobile number or password") from None

    user = session.scalar(select(User).where(User.phone == normalized))
    if user is None or user.password_hash is None:
        burn_verification_time(password)
        raise InvalidCredentials("invalid mobile number or password")

    _check_not_locked(user, now)

    if not verify_password(user.password_hash, password):
        _register_failure(session, user, now)
        raise InvalidCredentials("invalid mobile number or password")

    agency = session.get(Agency, user.agency_id)
    if not user.is_active or agency is None or not agency.is_active:
        # Correct password but disabled account: same answer as a wrong password.
        raise InvalidCredentials("invalid mobile number or password")

    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = now
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(password)

    raw, token_hash = generate_token()
    row = AuthSession(
        user_id=user.id,
        token_hash=token_hash,
        created_at=now,
        expires_at=now + timedelta(days=settings.session_idle_days),
        last_used_at=now,
        user_agent=(user_agent or None) and user_agent[:255],
        ip_address=ip,
    )
    session.add(row)
    session.flush()
    return raw, row, user


def resolve_token(
    session: Session, raw_token: str, *, now: datetime | None = None
) -> AuthContext:
    """Validate a bearer token and return who it belongs to. Needs a SYSTEM session."""
    _require_system(session)
    now = now or _now()
    settings = get_settings()
    if not raw_token.startswith(TOKEN_PREFIX):
        raise NotAuthenticated("invalid or expired token")

    row = session.scalar(
        select(AuthSession).where(AuthSession.token_hash == hash_token(raw_token))
    )
    if row is None or row.revoked_at is not None or row.expires_at <= now:
        raise NotAuthenticated("invalid or expired token")

    user = session.get(User, row.user_id)
    agency = session.get(Agency, user.agency_id) if user else None
    if user is None or not user.is_active or agency is None or not agency.is_active:
        raise NotAuthenticated("invalid or expired token")

    if now - row.last_used_at >= _TOUCH_INTERVAL:
        # Sliding expiry, capped by the absolute maximum lifetime.
        cap = row.created_at + timedelta(days=settings.session_max_days)
        row.expires_at = min(now + timedelta(days=settings.session_idle_days), cap)
        row.last_used_at = now
        session.flush()

    return AuthContext(
        user_id=user.id,
        agency_id=user.agency_id,
        role=user.role,
        session_id=row.id,
        must_change_password=user.must_change_password,
    )


def logout(session: Session, raw_token: str, *, now: datetime | None = None) -> None:
    """Revoke the session behind a token. Idempotent."""
    _require_system(session)
    now = now or _now()
    session.execute(
        update(AuthSession)
        .where(AuthSession.token_hash == hash_token(raw_token), AuthSession.revoked_at.is_(None))
        .values(revoked_at=now)
    )


def revoke_user_sessions(
    session: Session,
    user_id: uuid.UUID,
    *,
    except_session_id: uuid.UUID | None = None,
    now: datetime | None = None,
) -> None:
    """Revoke all active sessions of a user (the caller must already be allowed to see the user)."""
    now = now or _now()
    stmt = update(AuthSession).where(
        AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None)
    )
    if except_session_id is not None:
        stmt = stmt.where(AuthSession.id != except_session_id)
    session.execute(stmt.values(revoked_at=now))


def change_password(
    session: Session,
    user_id: uuid.UUID,
    *,
    current_password: str,
    new_password: str,
    keep_session_id: uuid.UUID | None = None,
    now: datetime | None = None,
) -> None:
    """Self-service password change; ends all other sessions of the user."""
    now = now or _now()
    user = session.get(User, user_id)
    if user is None or user.password_hash is None:
        raise UserNotFound("user not found")
    _check_not_locked(user, now)
    if not verify_password(user.password_hash, current_password):
        _register_failure(session, user, now)
        raise WrongPassword("current password is incorrect")
    validate_password(new_password)
    user.password_hash = hash_password(new_password)
    user.must_change_password = False
    user.failed_login_attempts = 0
    session.flush()
    revoke_user_sessions(session, user.id, except_session_id=keep_session_id, now=now)


def reset_password(
    session: Session, user_id: uuid.UUID, *, new_password: str, now: datetime | None = None
) -> User:
    """Set a temporary password (manager/owner action). The user must change it at next login."""
    user = session.get(User, user_id)
    if user is None:
        raise UserNotFound("user not found")
    validate_password(new_password)
    user.password_hash = hash_password(new_password)
    user.must_change_password = True
    user.failed_login_attempts = 0
    user.locked_until = None
    session.flush()
    revoke_user_sessions(session, user.id, now=now)
    return user
