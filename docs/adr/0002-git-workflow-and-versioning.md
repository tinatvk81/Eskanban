# ADR-0002: Git workflow and versioning

- Status: Accepted
- Date: 2026-10-07

## Context
The owner wants disciplined history: standard commit messages, enforced automatically, and nothing committed or pushed without his approval.

## Decision
- Commits follow Conventional Commits 1.0.0, enforced by `.githooks/commit-msg` (header ≤ 72 chars).
- `.githooks/pre-commit` blocks env files and files over 5 MB.
- Hooks are enabled per clone with `make hooks` (`core.hooksPath`).
- Trunk-based: `master` is always deployable; work happens on short-lived branches named `<type>/<short-topic>`.
- Versioning: SemVer; `CHANGELOG.md` updated per release.
- Approval gate: the assistant proposes files and message; commit and push happen only after the owner accepts.
- Merge method: every change reaches `master` through a pull request, even when working solo. Only the very first commits were made directly, because the repository was empty. Squash merge is used so each PR becomes one Conventional Commit; the PR title must therefore follow the same format.


## Consequences
Clean, machine-readable history that enables automated changelogs. Slight friction on malformed messages — intentional.
