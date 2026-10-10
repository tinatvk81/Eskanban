"""Tenant isolation (ADR-0005, ADR-0008).

A session has one of three scopes, stored in ``session.info``:

* tenant scope  – an agency UUID. Reads/updates/deletes of every ``TenantMixin`` model are
  filtered to that agency, new rows get that ``agency_id``, and moving or touching rows of
  another agency raises ``TenantViolation``.
* SYSTEM        – explicit, trusted access to all tenants (provisioning, migrations, workers).
* no scope      – fail closed: tenant tables return no rows and refuse writes.

This is application-level protection. PostgreSQL row-level security is planned as a second
layer (see ADR-0008).
"""

import uuid
from typing import Any

from sqlalchemy import event, inspect
from sqlalchemy.orm import Session, with_loader_criteria

from app.db.models.mixins import TenantMixin

TENANT_KEY = "tenant_scope"


class TenantViolation(Exception):
    """Code tried to cross a tenant boundary or write without a tenant scope."""


class _SystemScope:
    def __repr__(self) -> str:
        return "SYSTEM"


SYSTEM = _SystemScope()
Scope = uuid.UUID | _SystemScope | None


def get_scope(session: Session) -> Scope:
    return session.info.get(TENANT_KEY)


@event.listens_for(Session, "do_orm_execute")
def _apply_scope(state: Any) -> None:
    if not (state.is_select or state.is_update or state.is_delete):
        return
    scope = state.session.info.get(TENANT_KEY)
    if scope is SYSTEM:
        return
    if scope is None:
        # Fail closed: agency_id is NOT NULL, so this matches nothing.
        criteria = with_loader_criteria(
            TenantMixin, lambda cls: cls.agency_id.is_(None), include_aliases=True
        )
    else:
        agency_id = scope
        criteria = with_loader_criteria(
            TenantMixin, lambda cls: cls.agency_id == agency_id, include_aliases=True
        )
    state.statement = state.statement.options(criteria)


@event.listens_for(Session, "before_flush")
def _guard_writes(session: Session, flush_context: Any, instances: Any) -> None:
    scope = session.info.get(TENANT_KEY)
    if scope is SYSTEM:
        return
    new = set(session.new)
    for obj in [*session.new, *session.dirty, *session.deleted]:
        if not isinstance(obj, TenantMixin):
            continue
        if scope is None:
            raise TenantViolation("tenant data cannot be written without a tenant scope")
        if obj in new:
            if obj.agency_id is None:
                obj.agency_id = scope
            elif obj.agency_id != scope:
                raise TenantViolation("cannot create data for another agency")
        else:
            if inspect(obj).attrs.agency_id.history.has_changes():
                raise TenantViolation("cannot move data between agencies")
            if obj.agency_id != scope:
                raise TenantViolation("cannot modify data of another agency")
