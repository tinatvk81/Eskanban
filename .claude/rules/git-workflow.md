# Git workflow rules (summary of ADR-0002)

- Header: `<type>(<scope>)!: <description>` — max 72 chars, imperative mood, no trailing period.
- Types: feat, fix, docs, refactor, perf, test, build, ci, chore, style, revert.
- Scopes (lowercase): web, api, scraper, agents, shared, infra, docs, files, clients, matching,
  deals, accounting, listings, sites, auth, tenancy, i18n, theme.
- Body (optional): explain *why*, wrap at 72. Footer: `BREAKING CHANGE:` / `Refs: #id`.
- One logical change per commit. Never commit secrets (`.env`), the pre-commit hook blocks them.
- Flow: branch -> work -> propose commit to owner -> owner accepts -> commit -> push -> PR (squash merge).
- Shortcut for the owner: `bash scripts/ship.sh "<message>" [--pr]` shows the changes, asks
  "Accept? [y/N]", then commits and pushes. Never bypass the prompt on the owner's behalf.
