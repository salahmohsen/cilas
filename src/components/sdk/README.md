# `src/components/sdk/`

Parts that free Arc does not have, built on ui-sdk and styled in the Arc style. See [ADR 0012](../../../docs/adr/0012-ui-sdk-wrappers.md).

## What lives here

One wrapper per part. A wrapper imports `@ui-sdk/*` and exposes a small interface to app code. This folder and `src/components/calendar/ui/` are the only places that may import `@ui-sdk/*`; the lint rule `no-restricted-imports` enforces it.

Use this order before you add a wrapper: installed Arc component, free Arc registry, ui-sdk, a Radix primitive the repo already uses, your own code. Never use two primitive families for one job.

## Wrapper contract

- Read the ui-sdk skill first: `.agents/skills/ui-sdk/SKILL.md`.
- Style the part with Arc tokens, radii, focus ring and motion. Honor `prefers-reduced-motion`.
- App code imports the wrapper, never `@ui-sdk/*`.
- Keep the interface smaller than ui-sdk's. No pass-through wrappers.

## Test rule

Every wrapper has a browser test (`*.browser.test.tsx`, next to the wrapper) for keyboard, focus, right-to-left and reduced motion. ui-sdk is a beta and its version is pinned exactly. A ui-sdk upgrade is its own PR and runs these tests.
