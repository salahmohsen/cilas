# 0012. ui-sdk builds the parts free Arc lacks, through wrappers in `src/components/sdk/`

Accepted, 2026-11-21. Widens [0011](0011-calendar-sessions-replace-schedule-pattern.md), which let only the calendar import ui-sdk.

## Context

The site uses Arc (`src/components/arc`) for its interface. Free Arc does not have every part we need. Arc Pro blocks, for example the Sidebar block, are not free. The portal plan needs several such parts.

ADR 0011 already adds ui-sdk (`@ui-sdk/core` and `@ui-sdk/react`, pinned to `0.1.0-beta.1`) for the calendar. It has behaviors (keyboard, focus, selection, dismissal, popups, drag and drop, ARIA) and it has no styles. The lint rule `no-restricted-imports` allows `@ui-sdk/*` only in `src/components/calendar/ui/`. A new part therefore has two choices today: write it by hand, or break the rule.

The `check-open-source-first` rule asks for a maintained open-source option before we build our own. ui-sdk is that option for these parts. It is a beta, so its API can change between versions.

## Decision

**For a part that free Arc does not have, build it on ui-sdk. Wrap it in the Arc style in `src/components/sdk/`.**

Order of choice, for each component:

1. The Arc component already installed in `src/components/arc`.
2. The free Arc registry.
3. ui-sdk, through a wrapper in `src/components/sdk/`.
4. A Radix primitive the repo already uses.
5. Our own code.

Never use two primitive families for one job. One dialog system and one focus and Esc behavior apply to the whole site.

Rules for ui-sdk:

- Only two places import `@ui-sdk/*`: `src/components/calendar/ui/` (ADR 0011, unchanged) and `src/components/sdk/`. The lint rule enforces this.
- Each wrapper styles the ui-sdk part in the Arc style: Arc tokens, radii, focus ring, motion, and reduced motion. App code imports the wrapper. App code never imports `@ui-sdk/*`.
- Before you write a wrapper, read the ui-sdk skill that ships in the package (`node_modules/@ui-sdk/core/skills/ui-sdk/SKILL.md`, linked from `.agents/skills/ui-sdk/`).
- ui-sdk is a beta. Keep the exact version pin (no `^` or `~`).
- Every wrapper has a browser test for keyboard, focus, right-to-left, and reduced motion.
- A ui-sdk upgrade is its own PR. It runs those tests.

## Consequences

- A new part that free Arc lacks starts from tested keyboard, focus and ARIA behavior. We do not write it again.
- The beta risk stays in one folder. An API change in ui-sdk touches the wrappers, and the browser tests show it. App code does not change.
- Each wrapper is a thin layer with its own tests. A wrapper whose interface only copies the ui-sdk interface is a pass-through and should not exist. Give it a smaller interface that fits our use.
- The lint rule now has two allowed folders. A third folder needs a new ADR.
- If Arc later adds a part that a wrapper covers, move to the Arc part and delete the wrapper (order of choice, step 1 or 2).
- This ADR builds nothing. Each wrapper arrives in the PR that needs it.
