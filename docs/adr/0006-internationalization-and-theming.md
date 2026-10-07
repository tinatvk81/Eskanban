# ADR-0006: Internationalization and theming

- Status: Accepted
- Date: 2026-10-07

## Context
Launch is Persian (RTL); the owner may go international. Users should be able to choose light or dark.

## Decision
- All UI strings go through an i18n layer from day one; Persian default, English-ready; RTL/LTR via logical CSS properties.
- Light and dark themes use the tokens in `docs/context/design-system.md`.
- Code, docs and commits stay in English.

## Consequences
Slightly slower first screens; avoids a costly retrofit later. Dates need Jalali and Gregorian support.
