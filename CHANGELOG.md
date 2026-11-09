# Changelog

All notable changes are documented here. Format: [Keep a Changelog](https://keepachangelog.com/),
versioning: [SemVer](https://semver.org/).

## [Unreleased]
### Added
- Repository foundation: docs, ADRs, roadmap, git hooks.
- Pull request template and `scripts/ship.sh` (review, accept, commit, push).
- Walking skeleton: Next.js web app and FastAPI api with health checks, themes, RTL i18n and CI.
- Database layer, Alembic migrations, agencies and users, tenant isolation with tests.
- Mobile-number login, revocable sessions, team management endpoints and operator CLI.
- Web login, forced password change and dashboard pages (cookie-based sessions through the web server).
- Property files backend: data model, filters, visibility, history, favorites, geography data and vocabularies.
- Document dimensions for property files (migration 0004): official/informal document types, deed scope, ownership kind (freehold/waqf), divided flag and dang filters.
- Web: property files list page with search, filters, sorting and pagination (server-rendered through the web server).
