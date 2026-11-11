# Applicants review

Job: Review applications and make acceptance decisions quickly.
Primary action: Accept an application with its saved course approvals.
Regions: Arc filter toolbar, expandable card grid, shared form questions, rejection dialog.

## Decisions and the problems they solve

- Extract `PayloadQuestion` from the public form and give it a read-only view. Both forms and applicant details use the same question metadata and help text. Saved labels and values remain available when questions or options change.
  - Problem: A separate admin answer layout would drift from the application form and could lose historical answers.
- Add media and summary slots to the installed expandable card. Media belongs to its expansion trigger; actions remain outside the trigger and details retain the existing morph and reduced-motion handling.
  - Problem: Nesting action buttons inside a clickable card creates invalid interaction semantics. Nesting cards duplicates surfaces.
- Keep the existing guarded accept/reject endpoints, course approvals, transactions and email behavior. Surface failed email delivery separately from a failed decision.
  - Problem: A new mutation would duplicate enrollment rules and could report a committed acceptance as a failure.
- Keep the fellow projection, omit financial data for fellows, and populate only display metadata for cycle and cover relationships. Filter on a single matching course choice.
  - Problem: A multi-course application must not expose another fellow's answers, or match a reduction on a different course from the selected course.
- Store filters in URL parameters, preserving unrelated parameters. Track successful decisions in the current view so status filters update immediately.
  - Problem: Local-only filters cannot be shared or restored with browser history; stale statuses can lead to repeated decisions.

## Arc review

- [x] Sentence case, localized copy, semantic tokens and logical layout properties.
- [x] Installed Arc components, real data and promise-returning decision callbacks.
- [x] Loading skeleton, empty states, inline errors, pending and success states.
- [x] Responsive grid, wrapping actions and long values, scoped dark-theme tokens.
- [x] Existing morph motion, reduced motion and dialog focus behavior preserved.
- [ ] Live browser review at 390, 768, 1024 and 1440px, dark mode and RTL. No app dev server was available; these were reviewed in source only.

## Verification

- `pnpm typecheck`: passed.
- `pnpm lint`: passed with existing warnings outside the changed files; focused lint reports no warnings.
- Focused unit tests: 10 passed across applicant interactions and server data projection. Network calls and Payload are mocked; no database was contacted.
- Existing integration assertions were updated for the richer display data without removing the financial-access checks. Integration tests were not run because this worktree has no configured local database.
- No migrations, deployment, push or PR.
