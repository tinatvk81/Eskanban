# Eskanban (اسکان‌بان)

Multi-tenant SaaS for real estate agencies: property files, client matching,
deal pipeline, commission accounting, new-listing intake and mini agency websites.

> Status: **Phase 0 – Foundation**. See [docs/roadmap.md](docs/roadmap.md).

## Repository layout

| Path | Purpose |
|---|---|
| `apps/web` | Next.js (TypeScript) frontend |
| `apps/api` | FastAPI (Python) backend |
| `apps/scraper` | Python scraper / ingestion workers |
| `apps/agents` | Reserved for future AI / agent services |
| `packages/shared` | Shared contracts (API schemas, design tokens) |
| `infra` | Deployment notes and config (Runflare) |
| `docs` | Roadmap, context, ADRs, deviations, sources |

## Getting started

```bash
git config core.hooksPath .githooks   # enable commit-msg / pre-commit hooks (once per clone)
# or: make hooks (if make is installed)
```

Start every working session with [docs/context/project-context.md](docs/context/project-context.md).
Commits follow [Conventional Commits](https://www.conventionalcommits.org/) — see
[ADR-0002](docs/adr/0002-git-workflow-and-versioning.md).
