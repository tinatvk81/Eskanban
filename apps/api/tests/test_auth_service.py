import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.core.config import get_settings
from app.core.errors import (
    AccountLocked,
    InvalidCredentials,
    NotAuthenticated,
    WrongPassword,
)
from app.core.security import hash_token
from app.db.models import Agency, AuthSession, Role, User
from app.db.session import system_session, tenant_session
from app.services import auth
from app.services.agencies import add_user, deactivate_user
from tests.conftest import PASSWORD

T0 = datetime(2026, 1, 1, 12, 0, tzinfo=UTC)


def _login(db, info, now=T0, password=PASSWORD):
    with system_session(engine=db) as s:
        token, row, user = auth.authenticate(s, phone=info["phone"], password=password, now=now)
        s.commit()
        return token, row.id, user.id


def _fail(db, info, now=T0, password="wrong-password"):
    with system_session(engine=db) as s, pytest.raises((InvalidCredentials, AccountLocked)) as exc:
        auth.authenticate(s, phone=info["phone"], password=password, now=now)
    return exc.value


def _resolve(db, token, now=T0):
    with system_session(engine=db) as s:
        ctx = auth.resolve_token(s, token, now=now)
        s.commit()
        return ctx


def _user(db, user_id):
    with system_session(engine=db) as s:
        return s.get(User, user_id)


def test_login_creates_session_and_stores_only_the_hash(db, make_agency):
    info = make_agency("login")
    token, session_id, user_id = _login(db, info)
    with system_session(engine=db) as s:
        row = s.get(AuthSession, session_id)
        assert row.token_hash == hash_token(token) != token
        assert row.expires_at == T0 + timedelta(days=get_settings().session_idle_days)
        assert s.get(User, user_id).last_login_at == T0


def test_login_accepts_any_phone_format(db, make_agency):
    info = make_agency("formats", manager_phone="09123334455")
    with system_session(engine=db) as s:
        for variant in ["+989123334455", "۰۹۱۲۳۳۳۴۴۵۵", "0098 912 333 4455"]:
            auth.authenticate(s, phone=variant, password=PASSWORD, now=T0)
    assert info["phone"] == "+989123334455"


@pytest.mark.parametrize("phone", ["09129999999", "not a phone", ""])
def test_unknown_or_invalid_phone_is_invalid_credentials(db, make_agency, phone):
    make_agency("unknown")
    with system_session(engine=db) as s, pytest.raises(InvalidCredentials):
        auth.authenticate(s, phone=phone, password=PASSWORD, now=T0)


def test_wrong_password_is_counted_and_persisted(db, make_agency):
    info = make_agency("count")
    _fail(db, info)
    assert _user(db, info["manager_id"]).failed_login_attempts == 1


def test_lockout_after_max_failures_then_recovery(db, make_agency):
    info = make_agency("lock")
    limit = get_settings().max_failed_logins
    for _ in range(limit):
        _fail(db, info)
    locked = _user(db, info["manager_id"])
    assert locked.locked_until == T0 + timedelta(minutes=get_settings().lockout_minutes)

    # even the CORRECT password is refused while locked
    err = _fail(db, info, now=T0 + timedelta(minutes=1), password=PASSWORD)
    assert isinstance(err, AccountLocked) and err.retry_after_seconds > 0

    # after the lock expires, login works and the counters reset
    later = T0 + timedelta(minutes=get_settings().lockout_minutes + 1)
    _login(db, info, now=later)
    user = _user(db, info["manager_id"])
    assert user.failed_login_attempts == 0 and user.locked_until is None


def test_successful_login_resets_failed_attempts(db, make_agency):
    info = make_agency("reset")
    _fail(db, info)
    _fail(db, info)
    _login(db, info)
    assert _user(db, info["manager_id"]).failed_login_attempts == 0


def test_inactive_user_cannot_log_in(db, make_agency):
    info = make_agency("inactive", seats=3)
    with tenant_session(info["agency_id"], engine=db) as s:
        advisor = add_user(
            s, phone="09124445566", full_name="A", role=Role.ADVISOR, password=PASSWORD
        )
        deactivate_user(s, advisor.id)
        s.commit()
    with system_session(engine=db) as s, pytest.raises(InvalidCredentials):
        auth.authenticate(s, phone="09124445566", password=PASSWORD, now=T0)


def test_inactive_agency_cannot_log_in(db, make_agency):
    info = make_agency("agency-off")
    with system_session(engine=db) as s:
        s.get(Agency, info["agency_id"]).is_active = False
        s.commit()
    with system_session(engine=db) as s, pytest.raises(InvalidCredentials):
        auth.authenticate(s, phone=info["phone"], password=PASSWORD, now=T0)


def test_resolve_token_returns_identity(db, make_agency):
    info = make_agency("resolve", must_change=True)
    token, session_id, user_id = _login(db, info)
    ctx = _resolve(db, token)
    assert (ctx.user_id, ctx.agency_id, ctx.session_id) == (user_id, info["agency_id"], session_id)
    assert ctx.role is Role.MANAGER and ctx.must_change_password


@pytest.mark.parametrize("bad", ["", "garbage", "esk_unknowntoken"])
def test_resolve_rejects_unknown_tokens(db, bad):
    with system_session(engine=db) as s, pytest.raises(NotAuthenticated):
        auth.resolve_token(s, bad, now=T0)


def test_resolve_rejects_expired_session(db, make_agency):
    info = make_agency("expired")
    token, _, _ = _login(db, info)
    idle = get_settings().session_idle_days
    with pytest.raises(NotAuthenticated):
        _resolve(db, token, now=T0 + timedelta(days=idle, seconds=1))


def test_sliding_expiry_extends_but_is_capped(db, make_agency):
    info = make_agency("sliding")
    token, session_id, _ = _login(db, info)
    settings = get_settings()
    now = T0
    for _ in range(10):  # keep using it every (idle - 1) days
        now += timedelta(days=settings.session_idle_days - 1)
        try:
            _resolve(db, token, now=now)
        except NotAuthenticated:
            break
    with system_session(engine=db) as s:
        row = s.get(AuthSession, session_id)
        assert row.expires_at <= T0 + timedelta(days=settings.session_max_days)
    # past the absolute cap the session is dead no matter how active it was
    with pytest.raises(NotAuthenticated):
        _resolve(db, token, now=T0 + timedelta(days=settings.session_max_days, seconds=1))


def test_logout_revokes_and_is_idempotent(db, make_agency):
    info = make_agency("logout")
    token, _, _ = _login(db, info)
    with system_session(engine=db) as s:
        auth.logout(s, token, now=T0)
        auth.logout(s, token, now=T0)
        s.commit()
    with pytest.raises(NotAuthenticated):
        _resolve(db, token)


def test_change_password_flow(db, make_agency):
    info = make_agency("change")
    keep_token, keep_id, user_id = _login(db, info)
    other_token, _, _ = _login(db, info)
    with tenant_session(info["agency_id"], engine=db) as s:
        with pytest.raises(WrongPassword):
            auth.change_password(
                s, user_id, current_password="nope", new_password="New-pass-456"
            )
        auth.change_password(
            s,
            user_id,
            current_password=PASSWORD,
            new_password="New-pass-456",
            keep_session_id=keep_id,
            now=T0,
        )
        s.commit()
    assert _resolve(db, keep_token).user_id == user_id  # current session survives
    with pytest.raises(NotAuthenticated):
        _resolve(db, other_token)  # other sessions are ended
    assert _user(db, user_id).must_change_password is False
    _login(db, info, password="New-pass-456")
    _fail(db, info, password=PASSWORD)  # old password no longer works


def test_reset_password_forces_change_and_revokes_sessions(db, make_agency):
    info = make_agency("admin-reset")
    token, _, user_id = _login(db, info)
    with tenant_session(info["agency_id"], engine=db) as s:
        auth.reset_password(s, user_id, new_password="Temp-pass-789")
        s.commit()
    with pytest.raises(NotAuthenticated):
        _resolve(db, token)
    assert _user(db, user_id).must_change_password is True
    _login(db, info, password="Temp-pass-789")


def test_reset_password_cannot_reach_another_agency(db, make_agency):
    a = make_agency("reset-a")
    b = make_agency("reset-b")
    with tenant_session(a["agency_id"], engine=db) as s, pytest.raises(Exception) as exc:
        auth.reset_password(s, b["manager_id"], new_password="Temp-pass-789")
    assert exc.value.code == "user_not_found"


def test_deactivation_ends_sessions(db, make_agency):
    info = make_agency("deact", seats=3)
    with tenant_session(info["agency_id"], engine=db) as s:
        advisor = add_user(
            s, phone="09126667788", full_name="A", role=Role.ADVISOR, password=PASSWORD
        )
        s.commit()
        advisor_id = advisor.id
    with system_session(engine=db) as s:
        token, _, _ = auth.authenticate(s, phone="09126667788", password=PASSWORD, now=T0)
        s.commit()
    with tenant_session(info["agency_id"], engine=db) as s:
        deactivate_user(s, advisor_id)
        s.commit()
    with pytest.raises(NotAuthenticated):
        _resolve(db, token)


def test_authenticate_requires_system_session(db, make_agency):
    info = make_agency("scope")
    with tenant_session(info["agency_id"], engine=db) as s, pytest.raises(Exception) as exc:
        auth.authenticate(s, phone=info["phone"], password=PASSWORD)
    assert exc.value.code == "scope_required"


def test_unknown_user_uuid_not_found(db, make_agency):
    info = make_agency("nouser")
    with tenant_session(info["agency_id"], engine=db) as s, pytest.raises(Exception) as exc:
        auth.change_password(
            s, uuid.uuid4(), current_password="x", new_password="New-pass-456"
        )
    assert exc.value.code == "user_not_found"


def test_users_listing_does_not_expose_hashes_in_orm_select(db, make_agency):
    info = make_agency("hashes")
    with system_session(engine=db) as s:
        user = s.scalar(select(User).where(User.id == info["manager_id"]))
        assert user.password_hash.startswith("$argon2id$")


def test_deactivation_marks_sessions_revoked_in_the_database(db, make_agency):
    """Layer 1: sessions are revoked when the user is deactivated."""
    info = make_agency("revoked-flag", seats=3)
    with tenant_session(info["agency_id"], engine=db) as s:
        advisor = add_user(
            s, phone="09126660001", full_name="A", role=Role.ADVISOR, password=PASSWORD
        )
        s.commit()
        advisor_id = advisor.id
    with system_session(engine=db) as s:
        _, row, _ = auth.authenticate(s, phone="09126660001", password=PASSWORD, now=T0)
        s.commit()
        session_id = row.id
    with tenant_session(info["agency_id"], engine=db) as s:
        deactivate_user(s, advisor_id)
        s.commit()
    with system_session(engine=db) as s:
        assert s.get(AuthSession, session_id).revoked_at is not None


def test_token_of_inactive_user_is_rejected_even_if_session_not_revoked(db, make_agency):
    """Layer 2: resolving a token re-checks that the user is still active."""
    info = make_agency("inactive-check")
    token, _, user_id = _login(db, info)
    with system_session(engine=db) as s:
        s.get(User, user_id).is_active = False  # bypasses the service: session stays unrevoked
        s.commit()
    with pytest.raises(NotAuthenticated):
        _resolve(db, token)


def test_token_of_inactive_agency_is_rejected(db, make_agency):
    info = make_agency("agency-token-check")
    token, _, _ = _login(db, info)
    with system_session(engine=db) as s:
        s.get(Agency, info["agency_id"]).is_active = False
        s.commit()
    with pytest.raises(NotAuthenticated):
        _resolve(db, token)
