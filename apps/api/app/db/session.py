from collections.abc import Iterator
from functools import lru_cache
from uuid import UUID

from sqlalchemy import Engine, create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.tenancy import SYSTEM, TENANT_KEY, Scope


@lru_cache
def get_engine() -> Engine:
    return create_engine(get_settings().database_url, pool_pre_ping=True)


def new_session(scope: Scope = None, *, engine: Engine | None = None) -> Session:
    session = Session(bind=engine or get_engine(), expire_on_commit=False)
    if scope is not None:
        session.info[TENANT_KEY] = scope
    return session


def tenant_session(agency_id: UUID, *, engine: Engine | None = None) -> Session:
    return new_session(agency_id, engine=engine)


def system_session(*, engine: Engine | None = None) -> Session:
    return new_session(SYSTEM, engine=engine)


def get_session() -> Iterator[Session]:
    """FastAPI dependency. Unscoped (fail closed) until authentication sets a tenant scope."""
    session = new_session()
    try:
        yield session
    finally:
        session.close()


def check_database() -> bool:
    try:
        with get_engine().connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except SQLAlchemyError:
        return False
