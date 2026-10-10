def normalize_database_url(url: str) -> str:
    """Make hosting-provided URLs work with SQLAlchemy + psycopg 3.

    Providers often hand out ``postgres://`` or ``postgresql://``; SQLAlchemy needs the
    driver in the scheme (``postgresql+psycopg://``).
    """
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url
