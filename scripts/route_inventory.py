#!/usr/bin/env python3
"""List backend endpoints (from FastAPI openapi.json) and flag which ones
are referenced anywhere in the web frontend source.

Usage (from repo root, with uvicorn running):
    python3 scripts/route_inventory.py
    python3 scripts/route_inventory.py http://127.0.0.1:8000 apps/web/src
"""
import json
import sys
import urllib.request
from pathlib import Path

API = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000"
SRC = Path(sys.argv[2] if len(sys.argv) > 2 else "apps/web/src")

HTTP_METHODS = {"get", "post", "put", "patch", "delete"}

spec = json.load(urllib.request.urlopen(f"{API}/openapi.json", timeout=10))

code = "\n".join(
    p.read_text(encoding="utf-8", errors="ignore")
    for p in SRC.rglob("*")
    if p.suffix in {".ts", ".tsx"} and "node_modules" not in p.parts
)

rows = []
for path, methods in sorted(spec["paths"].items()):
    # Heuristic: compare the static prefix before the first {param}.
    needle = path.split("{")[0].rstrip("/")
    used = bool(needle) and needle in code
    for method in methods:
        if method.lower() in HTTP_METHODS:
            tag = (methods[method].get("tags") or ["-"])[0]
            rows.append((tag, method.upper(), path, "USED" if used else "NOT USED"))

width = max(len(r[2]) for r in rows) if rows else 10
for tag, method, path, status in sorted(rows):
    print(f"{tag:<14} {method:<7} {path:<{width}}  {status}")

used_count = sum(1 for r in rows if r[3] == "USED")
print(f"\n{len(rows)} endpoints, {used_count} referenced in frontend, "
      f"{len(rows) - used_count} not yet used.")