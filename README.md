# Eskanban (اسکان‌بان)

Multi-tenant SaaS for real estate agencies: property files, client matching,
deal pipeline, commission accounting, new-listing intake and mini agency websites.

> Status: **Phase 2 – Files MVP (Backend and Frontend in progress)**. See [docs/roadmap.md](docs/roadmap.md).

## Repository layout

| Path | Purpose |
|---|---|
| `apps/web` | Next.js (TypeScript) frontend |
| `apps/api` | FastAPI (Python) backend |
| `apps/scraper` | Python scraper / ingestion workers |
| `apps/agents` | Reserved for future AI / agent services |
| `packages/shared` | Shared contracts (API schemas, design tokens) |
| `infra` | Deployment notes and config (Runflare) |
| `docs` | Roadmap, context, design system and sources |

## Getting started

```bash
git config core.hooksPath .githooks   # enable commit-msg / pre-commit hooks (once per clone)
# or: make hooks (if make is installed)
```

Start every working session with [docs/context/project-context.md](docs/context/project-context.md).
Commits follow [Conventional Commits](https://www.conventionalcommits.org/); see `.claude/rules/git-workflow.md` for the commit format and workflow. Use `scripts/ship.sh` to review and ship changes after owner approval.
