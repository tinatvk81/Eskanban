# CLAUDE.md — working rules for AI sessions

1. **Read first:** `docs/context/project-context.md` (single source of truth). Do NOT load
   every ADR; open an ADR only when the task touches its topic (index in `docs/adr/README.md`).
2. **Language:** code, comments, docs, commit messages and PR text are in English.
   User-facing UI is Persian-first (RTL) with English-ready i18n.
3. **Git approval gate:** never commit or push on your own. Propose the commit (files + message),
   wait for the owner's explicit "accept", then commit and push. Rules: `.claude/rules/git-workflow.md`.
4. **Uncertain? Ask first.** If a requirement is ambiguous or you are not sure, ask before answering/building.
5. **Decisions** that change architecture go into a new ADR (`docs/adr/template.md`); deviations
   from an accepted decision go into `docs/deviations/`.
6. **Keep context small:** update `project-context.md` when a decision changes instead of re-explaining it in chat.
