# CLAUDE.md — working rules for AI sessions

1. **Read first:** `docs/context/project-context.md` (current project context) and
   `docs/roadmap.md` (implementation progress, findings, risks, and pending decisions).
2. **Language:** code, comments, docs, commit messages and PR text are in English.
   User-facing UI is Persian-first (RTL) with English-ready i18n.
3. **Git approval gate:** never commit or push on your own. Propose the commit (files + message),
   wait for the owner's explicit "accept", then commit and push. Rules: `.claude/rules/git-workflow.md`.
4. **Uncertain? Ask first.** If a requirement is ambiguous or you are not sure, ask before answering/building.
5. **Architecture and product decisions:** record important decisions, their reasoning, and
   practical consequences in `docs/roadmap.md` or `docs/context/project-context.md`.
   Do not create numbered decision records.
6. **Keep context current:** update `project-context.md` when enduring project rules or decisions
   change, and update the Roadmap when implementation progress, findings, or risks change.
