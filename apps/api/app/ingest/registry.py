"""Connector registry (F7 S2.4): maps a source key to a connector factory.

Empty on purpose: real connectors are added per source in slice S3, each only
after its access gate is recorded in docs/listing-sources.md. Tests register fakes.
"""

from __future__ import annotations

from collections.abc import Callable

from app.ingest.contracts import ListingConnector

ConnectorFactory = Callable[[], ListingConnector]

CONNECTORS: dict[str, ConnectorFactory] = {}
