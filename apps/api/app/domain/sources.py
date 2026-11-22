"""Registry of listing sources (F7). The single source of truth in code;
docs/listing-sources.md is the human-readable mirror and must stay in sync.

Adding a source: add a row here (status "planned") and a row in
docs/listing-sources.md, then record the access gate before flipping it to
"enabled". Removing a source: set status to "retired" — never delete the key,
because old source_listings rows still reference it.
"""

from dataclasses import dataclass
from enum import StrEnum


class SourceStatus(StrEnum):
    PLANNED = "planned"
    ENABLED = "enabled"
    DISABLED = "disabled"
    RETIRED = "retired"


@dataclass(frozen=True)
class SourceInfo:
    key: str
    label_fa: str
    label_en: str
    status: SourceStatus
    domains: tuple[str, ...]  # hostnames used to detect this source from a pasted URL


SOURCES: tuple[SourceInfo, ...] = (
    SourceInfo("divar", "دیوار", "Divar", SourceStatus.PLANNED, ("divar.ir", "www.divar.ir")),
    SourceInfo(
        "sheypoor", "شیپور", "Sheypoor", SourceStatus.PLANNED, ("sheypoor.com", "www.sheypoor.com")
    ),
    SourceInfo("ihome", "آی‌هوم", "iHome", SourceStatus.PLANNED, ("ihome.ir", "www.ihome.ir")),
    SourceInfo("kilid", "کیلید", "Kilid", SourceStatus.PLANNED, ("kilid.com", "www.kilid.com")),
)

_BY_KEY = {s.key: s for s in SOURCES}


def get(key: str) -> SourceInfo | None:
    return _BY_KEY.get(key)


def is_valid_key(key: str) -> bool:
    return key in _BY_KEY


def detect_from_url(url: str) -> str | None:
    """Best-effort: match the URL's hostname against known source domains."""
    from urllib.parse import urlparse

    host = (urlparse(url).hostname or "").lower()
    for s in SOURCES:
        if host in s.domains:
            return s.key
    return None


def active_keys() -> tuple[str, ...]:
    return tuple(s.key for s in SOURCES if s.status != SourceStatus.RETIRED)
