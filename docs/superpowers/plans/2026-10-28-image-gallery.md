# Image gallery implementation plan

**Goal:** Add an ordered image gallery to rich text, including within existing Columns blocks.

**Architecture:** A Payload Gallery block stores image uploads, optional captions, and a column count. A client component renders a container-responsive grid and opens the Interior lightbox, adapted with modal primitives and gallery navigation. Existing single-image uploads remain unchanged.

**Tech stack:** Payload Lexical, React, CSS container queries, Motion, Radix Dialog.

- [x] Add behavior tests for image order, missing media, plain rendering, Columns nesting, opening, navigation, zoom, and focus restoration.
- [x] Create `src/blocks/gallery.ts`; register it in default, article, and column editors; regenerate Payload types.
- [x] Adapt the source from https://www.interior.dev/docs/lightbox into `src/components/interior/lightbox.tsx`, preserving zoom and thumbnail return animation while using Radix modal behavior.
- [x] Create `src/components/gallery/image-gallery.tsx` and its CSS module; add the gallery rich-text converter and English/Arabic labels.
- [x] Run focused Vitest tests with the explicitly local database URL, TypeScript, ESLint, and formatting checks. Review container sizing and reduced motion in code. Do not claim browser verification.

Validation: 18 tests across gallery, Columns, and mentions passed. TypeScript, scoped ESLint, Prettier, and `git diff --check` passed. Browser rendering and the admin authoring flow were not exercised.

Throughput checkpoint: implement schema and rendering as one unit, then navigation and modal behavior; verify each through focused tests. Work sequentially in this checkout. No commits, pushes, or deployment.
