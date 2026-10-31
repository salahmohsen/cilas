# Boat hero: design

Date: 2026-10-17
Status: approved

## Goal

Replace the home page hero (the classroom drawing) with a full-screen scene: an
animated ink-brush felucca, taken from the CILAS sail logo, with ink birds in the
sky and "CILAS in numbers" along the bottom. The nav bar is transparent while the
hero is on screen and solid again when it is not.

## Decisions

| Question     | Decision                                                                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visual       | Inline SVG boat in the logo's brush style, with ink "V" birds. No raster image.                                                                         |
| Hero content | Keep the title, text, rotating "who" line and the two actions. Add the three numbers at the bottom. Remove the separate `StatsBand` from the home page. |
| Scroll       | Normal scroll with scroll-linked motion. No scroll-jacking, no snap, no pinning.                                                                        |
| Colour       | Follows the site theme: black ink on paper (light), pale ink on a night river (dark).                                                                   |

## 1. Layout

- The hero is `min-height: 100svh` and full-bleed. It breaks out of the
  `max-w-300` `<main>` box.
- It starts under the sticky header: `margin-top: calc(-1 * var(--site-header-height))`.
  `--site-header-height` is already set by `CILASSiteHeader`.
- The text column stays aligned to the normal page width (1200px inner, the same
  as the header's `.inner`).
- Order from top to bottom: sky and birds; title, text, "who" line, actions (and
  the closed-state note); boat on the water; the three numbers as a horizon row.
- `HomeHero` keeps its current props and adds `stats: { value: number; label: string }[]`.
- `src/app/(frontend)/[locale]/page.tsx` passes the stats to `HomeHero` and no
  longer renders `<StatsBand>`. The `.home-stats` styles are removed if nothing
  else uses them.
- `/assets/images/cilas-classroom.jpg` stays: the Study mega-menu feature uses it.

## 2. Scene: `src/components/home/home-scene.tsx`

- A server-safe component that renders one inline `<svg aria-hidden>` (decorative;
  the hero heading carries the meaning).
- Hand-drawn paths in the logo's brush style:
  - Sail: the logo's triangle with its diagonal stripes.
  - Hull: one brush stroke under the sail.
  - Water: 3–4 uneven horizontal strokes.
  - Birds: 5–8 small "V" strokes at different sizes in the sky.
- Colour: strokes and fills use `currentColor`; the scene's `color` is
  `var(--foreground)` and the sky is `var(--background)`. No separate light/dark
  assets.
- Motion is CSS only, in `home-scene.module.css`:
  - Draw-in on load: `stroke-dasharray` / `stroke-dashoffset` for each stroke,
    staggered; fills fade in after their outline.
  - Loops after draw-in: the boat bobs (translateY, about 6px, about 6s); the sail
    sways (small rotate around the mast foot); the water lines drift sideways; the
    birds glide on slow, offset paths.
- RTL: `[dir='rtl']` mirrors the scene with `scale: -1 1`, so the boat sails in
  the reading direction.
- `prefers-reduced-motion: reduce`: no draw-in and no loops. The scene shows fully
  drawn and still.

## 3. Scroll-linked motion

- CSS scroll-driven animations with `animation-timeline: view()` and
  `animation-range: exit` on the hero:
  - The boat translates out toward the inline-end side.
  - The text block fades and moves up a little.
  - The water strokes thin and fade into the page.
- Wrapped in `@supports (animation-timeline: view())`. Browsers without support
  show a static hero that scrolls away normally. No polyfill, no JavaScript.
- Turned off under `prefers-reduced-motion: reduce`.

## 4. Nav bar

- `HomeHero` uses an `IntersectionObserver` on its section. While any part of the
  hero is under the header, it sets `data-over-hero` on `document.documentElement`.
  It removes the attribute when the hero leaves the screen and on unmount, so
  other pages never keep it.
- One rule in the site styles:
  `:root[data-over-hero] .header[data-scrolled]` keeps the background transparent,
  with no border and no shadow. The selector targets the Arc header's module
  class through a stable hook (add a `data-site-header` attribute or a
  `className` passed from `CILASSiteHeader`), not a hashed class name.
- When the hero leaves, the header turns solid with its existing transition.
- The open mega-menu panel keeps its own surface background, so it stays legible
  over the scene.
- The Arc `SiteHeader` API does not change.

## 5. Numbers

- Data: `getHomeStats(payload)` as now: years, courses, fellows, with the
  current `statYears`, `statCourses`, `statFellows` labels and `statsTitle` as a
  visually hidden heading for the row.
- They count up once on load (motion `animate`, the same easing as `StatsBand`).
  With reduced motion they show the final values at once.
- Formatting: `ar-EG` with the `arab` numbering system in Arabic, `en-GB` with
  `latn` in English, the same as now. The server renders the final values, so
  there is no layout shift and no-JS shows correct numbers.

## 6. Accessibility

- The SVG is `aria-hidden`. The heading, text, actions and numbers are real text.
- The existing screen-reader line for the "who" list stays.
- Text contrast on the scene: the text column sits over sky, not over strokes. Check
  WCAG AA in both themes.
- The transparent header keeps the foreground colour, which has full contrast on
  the background colour in both themes.

## 7. Testing

- Unit (vitest): `HomeHero` renders the three numbers with their labels, and renders
  the closed-state note when nothing is open.
- Playwright, in `en` and `ar`:
  - On load, the header has no solid background.
  - After scrolling past the hero, the header is solid.
  - After scrolling back to the top, the header is transparent again.
  - On another page (`/articles`), the header behaves as before.
- Manual check in the preview: light theme, dark theme, reduced motion, RTL, a
  narrow phone width and a wide desktop width.

## Out of scope

- Changes to the Arc `SiteHeader` component API.
- Scroll-snap, pinning, or any JavaScript scroll handling.
- Changes to sections below the hero, apart from removing `StatsBand`.
