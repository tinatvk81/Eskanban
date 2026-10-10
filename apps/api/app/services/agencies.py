"""Agency and user business rules. Services flush; the caller owns commit/rollback."""

import re
import uuid

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import (
    EmailTaken,
    InvalidInput,
    LastManager,
    PhoneTaken,
    ScopeRequired,
    SeatLimitReached,
    SlugTaken,
    UserNotFound,
)
from app.core.phone import normalize_phone
from app.core.security import hash_password, validate_password
from app.db.models import Agency, Plan, Role, User
from app.db.tenancy import SYSTEM, get_scope
from app.services.auth import revoke_user_sessions

SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

_SEAT_RULES = {
    Plan.SOLO: (1, 1),
    Plan.SMALL: (2, 5),
    Plan.LARGE: (6, None),
}


def _require_system(session: Session) -> None:
    if get_scope(session) is not SYSTEM:
        raise ScopeRequired("this operation needs a system session")


def _require_tenant(session: Session) -> uuid.UUID:
    scope = get_scope(session)
    if not isinstance(scope, uuid.UUID):
        raise ScopeRequired("this operation needs a tenant session")
    return scope


def _validate_seats(plan: Plan, seat_limit: int) -> None:
    low, high = _SEAT_RULES[plan]
    if seat_limit < low or (high is not None and seat_limit > high):
        span = f"{low}" if low == high else f"{low}-{high}" if high else f"{low}+"
        raise InvalidInput(f"plan '{plan.value}' allows {span} seats, got {seat_limit}")


def _clean_email(email: str | None) -> str | None:
    if email is None or not email.strip():
        return None
    email = email.strip().lower()
    if not EMAIL_RE.match(email) or len(email) > 254:
        raise InvalidInput("invalid email address")
    return email


def _clean_name(value: str, label: str, max_len: int = 120) -> str:
    value = value.strip()
    if not value or len(value) > max_len:
        raise InvalidInput(f"{label} must be 1-{max_len} characters")
    return value


def _build_user(
    *,
    agency_id: uuid.UUID | None,
    phone: str,
    email: str | None,
    full_name: str,
    role: Role,
    password: str,
) -> User:
    validate_password(password)
    return User(
        agency_id=agency_id,
        phone=normalize_phone(phone),
        email=_clean_email(email),
        full_name=_clean_name(full_name, "full name"),
        role=role,
        password_hash=hash_password(password),
        must_change_password=True,  # the person must pick their own password at first login
    )


def _flush_user(session: Session, user: User) -> None:
    """Flush a new user, mapping unique violations to domain errors."""
    try:
        with session.begin_nested():
            session.add(user)
            session.flush()
    except IntegrityError as exc:
        detail = str(exc.orig)
        if "uq_users_phone" in detail:
            raise PhoneTaken("this mobile number is already registered") from exc
        if "uq_users_email_lower" in detail:
            raise EmailTaken("this email is already registered") from exc
        raise


def create_agency(
    session: Session,
    *,
    name: str,
    slug: str,
    plan: Plan,
    seat_limit: int,
    manager_phone: str,
    manager_name: str,
    manager_password: str,
    manager_email: str | None = None,
) -> tuple[Agency, User]:
    """Provision a new agency with its first manager. Needs a SYSTEM session."""
    _require_system(session)
    name = _clean_name(name, "agency name")
    if not SLUG_RE.match(slug) or not 3 <= len(slug) <= 40:
        raise InvalidInput("slug must be 3-40 chars: lowercase letters, digits, single hyphens")
    _validate_seats(plan, seat_limit)
    manager = _build_user(
        agency_id=None,
        phone=manager_phone,
        email=manager_email,
        full_name=manager_name,
        role=Role.MANAGER,
        password=manager_password,
    )

    agency = Agency(name=name, slug=slug, plan=plan, seat_limit=seat_limit)
    try:
        with session.begin_nested():
            session.add(agency)
            session.flush()
    except IntegrityError as exc:
        if "uq_agencies_slug" in str(exc.orig):
            raise SlugTaken("this slug is already used") from exc
        raise

    manager.agency_id = agency.id
    _flush_user(session, manager)
    return agency, manager


def _lock_agency(session: Session, agency_id: uuid.UUID) -> Agency:
    """Row-lock the agency so seat/manager checks are safe under concurrent requests."""
    return session.execute(
        select(Agency).where(Agency.id == agency_id).with_for_update()
    ).scalar_one()


def add_user(
    session: Session,
    *,
    phone: str,
    full_name: str,
    role: Role,
    password: str,
    email: str | None = None,
) -> User:
    """Add a user to the session's agency, respecting the seat limit."""
    agency_id = _require_tenant(session)
    agency = _lock_agency(session, agency_id)
    active = session.scalar(select(func.count()).select_from(User).where(User.is_active))
    if active >= agency.seat_limit:
        raise SeatLimitReached(f"seat limit of {agency.seat_limit} reached")
    user = _build_user(
        agency_id=None,
        phone=phone,
        email=email,
        full_name=full_name,
        role=role,
        password=password,
    )
    _flush_user(session, user)
    return user


def list_users(session: Session) -> list[User]:
    _require_tenant(session)
    return list(session.scalars(select(User).order_by(User.created_at, User.full_name)))


def deactivate_user(session: Session, user_id: uuid.UUID) -> User:
    """Deactivate a user (frees a seat, ends their sessions).

    The last active manager cannot be deactivated.
    """
    agency_id = _require_tenant(session)
    _lock_agency(session, agency_id)
    user = session.get(User, user_id)
    if user is None:
        raise UserNotFound("user not found")
    if user.is_active and user.role is Role.MANAGER:
        managers = session.scalar(
            select(func.count())
            .select_from(User)
            .where(User.is_active, User.role == Role.MANAGER)
        )
        if managers <= 1:
            raise LastManager("an agency needs at least one active manager")
    user.is_active = False
    session.flush()
    revoke_user_sessions(session, user.id)
    return user
