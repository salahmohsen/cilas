# Content-driven card layouts

Use this guide when you build or change a card in CILAS: Open for registration posters, event posters, people profiles, or a new element that stacks media, a title, supporting text, and actions. The registration poster is the reference implementation.

The central decision is **which region receives spare space**. Make that decision explicitly for each layout. Every other region stays sized to its content.

## 1. Start from the content hierarchy

Before writing CSS, write down for the new element:

1. **Subject**: usually the image or avatar.
2. **Primary text**: the title or name. It is the strongest text on the card.
3. **Supporting text**: type label, fellows, bio, dates, metadata.
4. **Actions**: links and buttons.
5. **Optional fields**: which of the above can be missing, and what the card does then.
6. **Spare-space owner**: the one region that grows when the card is taller than its content.

Then pick a policy:

| Policy                     | Use for                                                                    | Grows                              |
| -------------------------- | -------------------------------------------------------------------------- | ---------------------------------- |
| **Media owns spare space** | Stacked registration posters, event posters, profile cards in a carousel.  | The image, cropped by focal point. |
| **Title owns spare space** | Text-led tiles; the side panel of a wide registration poster.              | The title cell.                    |
| **Content sizes all**      | Independent cards with no shared-height requirement (lists, grids of one). | Nothing; the card follows content. |

Do not give the image and the title independent growth rules unless sharing the extra height is intentional. Do not stretch names, labels, or metadata to compensate for a missing growth rule on a parent.

## 2. Rules

Use these as acceptance criteria. Update this list with each approved correction so the guide, implementation, and tests continue to agree.

### Sizing

1. Text cells (labels, titles, fellows, dates, actions) have no fixed height. Their height is their line boxes **plus padding and borders**. A longer name or several fellows make the cell taller.
2. Exactly one region owns spare height (section 1). On stacked cards that is the image.
3. A fellow or credit cell fits its text plus padding. It never absorbs unused card height.
4. Changing a breakpoint keeps these sizing responsibilities. Color and placement do not change them.

### Typography

5. The title is visually stronger than the type label and the fellow: larger size and the bold display face.
6. Use loaded font weights only. Poster titles use bold Playfair Display for Latin and IBM Plex Sans Arabic for Arabic, with a larger line height for Arabic. Do not request bold from a face that only ships regular.
7. Container-relative type uses `clamp()` with readable bounds. Check the longest real title at the narrowest width. Do not split names or truncate titles to keep a height constant.

### Boxes and borders

8. Use one shared padding token so labels, titles, fellows, and footer text align.
9. Each internal boundary has one owner. Example: the panel owns the image-to-text border, the type label owns its lower rule, the fellow cell owns its upper rule. No doubled borders, and no unbordered blank areas that merge with a neighboring cell.
10. Each card owns its rounded outline and clips its own content to it. A carousel viewport must not clip the card with a different radius (section 5).

### Closing date and countdown

11. The closing date and countdown stay adjacent in one row at every width and in RTL. Do not move the timer to its own row to fix overflow.
12. The date box fits its content; the timer fills the rest of the row and centers its content in both axes.
13. When space is tight, text and timer unit groups wrap inside their boxes and the row grows taller.
14. Keep the rule between date and timer, including on mobile and in RTL.

### Color, direction, and behavior

15. Registration posters and generated person avatars share the palette in `src/lib/poster-colors.ts`. Pass it to Boring Avatars through its built-in `colors` prop. Keep stable seeds and uploaded-photo precedence.
16. Use logical properties (`padding-inline`, `border-block-start`, `border-inline-end`). Set the document language and `dir="auto"` on mixed-language text.
17. Actions stay recognizable, keyboard reachable, and visibly focused. A card-wide link must not cover independent links such as a venue map.
18. Focal points, missing images, reduced motion, and translated labels are part of the component's behavior.
19. Verify rendered geometry, not only the presence of CSS classes.

## 3. Reusable implementation pattern

This is a suggested contract for new components. It is **not an API that `Poster` implements today**. Render a semantic input such as `spaceOwner: 'title' | 'media'` as a data attribute. Keep content, color, and placement as separate inputs.

```html
<div class="card-frame">
  <article class="content-card" data-space-owner="media">
    <div class="content-card__body">
      <div class="content-card__media"><!-- image --></div>
      <div class="content-card__panel">
        <p class="content-card__label">Thematic Course</p>
        <div class="content-card__heading">
          <h3 class="content-card__title">Course title</h3>
          <p class="content-card__credit">With the fellow</p>
        </div>
      </div>
    </div>
    <footer class="content-card__footer"><!-- details and action --></footer>
  </article>
</div>
```

```css
.card-frame {
  container: content-card / inline-size;
  display: grid;
}

.content-card,
.content-card__body,
.content-card__panel,
.content-card__heading {
  display: flex;
  flex-direction: column;
  min-inline-size: 0;
}

.content-card__body {
  flex: 1 1 auto;
}

.content-card__label,
.content-card__credit,
.content-card__footer {
  flex: 0 0 auto;
  margin: 0;
  padding: var(--space-4);
}

.content-card__title {
  margin: 0;
  padding: var(--space-4);
}

.content-card__media {
  position: relative;
  flex: 0 0 auto;
  aspect-ratio: var(--card-image-ratio, 16 / 10);
}

.content-card__media img {
  position: absolute;
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
}

[data-space-owner='title'] .content-card__panel,
[data-space-owner='title'] .content-card__heading,
[data-space-owner='title'] .content-card__title {
  flex: 1 1 auto;
}

[data-space-owner='media'] .content-card__media {
  flex: 1 0 auto;
}

[data-space-owner='media'] .content-card__panel {
  flex: 0 0 auto;
}
```

Notes:

- This is the stacked layout. Add a container query for side-by-side placement when the content fits.
- Every wrapper between the stretched body and the growing region must pass the height on. A growing child cannot claim space its parent never receives.
- Use explicit flex values (`1 1 auto`, `0 0 auto`). `flex: 1` expands to a `0%` basis, which can resolve differently when the container's main size is indefinite. See the [W3C Flexbox specification](https://www.w3.org/TR/css-flexbox-1/#flex-common) and [MDN on flex ratios](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Flexible_box_layout/Controlling_flex_item_ratios).
- Choose the composition from the card's container width, not the viewport. A card in a narrow desktop column may need the mobile layout. Posters use a named `poster` container and switch at `34rem`; that threshold belongs to posters only. See [MDN on container queries](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Containment/Container_size_and_style_queries).

## 4. Closing-date row recipe

A content-sized label followed by a flexible remainder. `minmax(0, 1fr)` is the grid form of `flex: 1` with a zero minimum width:

```css
.registration-strip {
  display: grid;
  grid-template-columns: auto fit-content(40%) minmax(0, 1fr);
}

.registration-date {
  min-inline-size: 0;
  overflow-wrap: anywhere;
}

.registration-timer {
  display: flex;
  min-inline-size: 0;
  align-items: center;
  justify-content: center;
}
```

The columns are mark, date, timer. The date takes its natural width up to 40%, so a long date wraps instead of pushing the timer out of the card. Wide posters also reserve 62% for the details and action column, so their date ceiling is 19% of the full strip. A strip without a timer uses a two-column layout on mobile. These percentages belong to this composition; keep the content-sized date and flexible timer when you adapt it.

Centering the timer box is not enough if the countdown widget inside keeps a fixed animated width or a non-wrapping minimum width. Keep the wrapper and its content shrinkable, let unit groups wrap, and test the digits against the cell bounds.

## 5. Cards inside an Arc carousel

The Arc carousel (`src/components/arc/carousel/`) moves a flex track of fixed-width slides. Its contract with the cards inside:

- **Slide width comes from `slideSize`**, a CSS length in `cqw` of the carousel root. The card must never be wider than its slide. Every grid between the slide and the card uses `grid-template-columns: minmax(0, 1fr)` and `min-width: 0`. An `auto` column grows to its content's min-content width, so one rigid cell (other font metrics on a phone, a countdown wheel, an image) makes the card wider than the slide. The viewport then clips its right border, and the card covers the next slide during a swipe. This was seen on iPhone and is covered by `tests/poster-layout.test.mjs`.
- **Shared height.** Slides stretch to the tallest slide. The spare-space owner (section 1) absorbs it. Make the slide a grid (`[aria-roledescription='slide'] { display: grid }`) so the card fills the slide height.
- **Neighbors are scaled to 0.9 and dimmed.** Leave enough side padding and gap that a scaled neighbor does not cover the active card. Do not add shadows or outlines that extend past the card edge.
- **Rounded corners.** The viewport clips the track horizontally and its default radius is `--radius-panel`, which is larger than the poster radius. Poster and profile carousels set `--carousel-viewport-radius: 0px` so each card draws its own rounded corners. Other carousels keep the default. Check all four card corners with rendered hit testing, not only the computed `border-radius`.
- **Direction.** The carousel wrapper is `dir="ltr"` so navigation always runs left to right. Each slide restores its own direction (`dir="auto"`, or the locale direction).
- **Rotation.** Content that people read closely (profiles) uses `autoplay={false}` and no `interval`, so there is no play/pause control.

Current carousels:

| Carousel          | Component                                   | `slideSize`                          | Rotation |
| ----------------- | ------------------------------------------- | ------------------------------------ | -------- |
| Open registration | `src/components/home/poster-carousel.tsx`   | `min(100cqw, 75rem)`                 | Yes      |
| Events            | `src/components/events/event-carousel.tsx`  | `min(84cqw, 28rem)`; 3 up from 900px | No       |
| Articles          | `src/components/home/home-articles.tsx`     | `min(84cqw, 420px)`                  | Yes      |
| People profiles   | `src/components/person/profile-columns.tsx` | `88cqw`, below `48rem` only          | No       |

### People-profile columns

Columns that contain person-profile blocks use the Arc carousel below `48rem`, one column per slide. Previous, next, indicators, keyboard, and dragging give manual navigation. At wider widths the same content uses the column count and ratio. The server renders the column layout; the mobile client switches to Arc after hydration. Do not render two sets of profile cards for the two layouts. Keep custom profile converters, public-profile visibility checks, and bio previews intact.

## 6. Shared palette and images

`POSTER_COLORS` in `src/lib/poster-colors.ts` holds the registration and avatar palette: yellow `#ffb71b`, blue `#1782ea`, pink `#ff7d9d`, green `#12d08f`. Registration posters take their color from this array unless a color is supplied. Generated Beam avatars pass the same array to the library's `colors` option; the library still draws faces in black or white. Uploaded photos have priority, and the person's stable seed selects the generated portrait.

Registration covers use `imageDelivery: 'direct'` on `PosterData`. Payload already stores uploads as WebP, so this avoids a second runtime transform and the upstream fetch timeouts seen in production. Direct delivery has no responsive `srcset`, so keep uploads to a sensible size. Other posters keep Next.js image optimization unless they opt in.

The registration carousel loads the active and next image eagerly, gives only the active image high fetch priority, and loads the rest lazily. Failed covers fall back to a local classroom image, or the logo when the poster asks for it. Fallback images do not reuse the original alt text or focal point.

## 7. Verification

Test the full sizing chain, including a taller neighboring slide. An isolated card can look correct while the carousel version fails.

- Narrow, medium, and wide containers, on both sides of the composition breakpoint.
- Short and long titles; one fellow, several fellows, no fellow.
- English, Arabic, and mixed-direction names.
- Larger text, 200% zoom, and narrow reflow with no clipped text or unreachable actions.
- Missing images, different focal points, wrapped footer details.
- Inside a carousel: no slide content extends past its slide, and the next and previous cards do not cover the active card at rest or during a swipe.

For image-led cards, assert that a taller neighbor makes the image grow while the text panel keeps its height. For title-led cards, assert that the title region grows while an unchanged fellow cell keeps its height and no empty area appears below it. DOM-only unit tests cannot measure layout; use rendered geometry.

`tests/poster-layout.test.mjs` loads the real poster stylesheet in Chromium with isolated markup that matches the sizing structure:

```sh
pnpm exec playwright install chromium
node --test tests/poster-layout.test.mjs
```

It covers the three poster placements at 288, 358, 528, and 960 CSS pixels, in English and Arabic, with wrapped and missing fellows. Stacked cards: image growth and stable text heights. Wide cards: title growth in the side panel. The pink card's countdown is checked from 240 to 960 pixels in both directions, with larger text and a stale inline animation size. It does not cover production fonts, real images, live countdowns, carousel animation, or a deployed page; check those visually when you change them. CI runs this test in the production-smoke job.

`tests/unit/person-profile-block.unit.spec.tsx` checks that profile columns become an Arc carousel on mobile in English and Arabic, with manual navigation and no rotation control.

## 8. Lessons from past bugs

- **Yellow mobile gap.** The carousel stretched slides to a shared height, but at the stacked breakpoint `.poster-panel` had `flex: none` and the image kept its aspect ratio. Spare height collected below the panel, white like the fellow cell and without a rule, so it looked like an oversized fellow box. `flex: none` on the fellow could not fix a parent's sizing. Fix: the image owns spare height (rule 2).
- **Cut corners in carousels.** The viewport clipped with `--radius-panel` over the poster's smaller radius. Fix: `--carousel-viewport-radius: 0px` (rule 10).
- **Timer overflow.** The countdown kept its animated inline width. Fix: natural dimensions and wrapping unit groups (rules 11 to 13).

## 9. Applying this to a new element

1. Write the content hierarchy and choose the spare-space owner (section 1).
2. Reuse `Poster` when its semantics fit. Otherwise follow section 3.
3. If it goes in a carousel, follow section 5 and add it to the table.
4. Add a rendered-geometry check or extend `tests/poster-layout.test.mjs`.
5. Add the new component to the file list below and record new rules in section 2.

Build a shared sizing primitive only when a second real component needs the same contract.

Files:

- `src/components/home/poster.tsx`: shared poster markup and registration marker.
- `src/components/home/open-now.tsx`: registration content and poster data.
- `src/app/(frontend)/styles.css`: poster sizing, container queries, typography, dividers.
- `src/components/home/poster-carousel.tsx`: registration carousel.
- `src/components/events/event-carousel.tsx`: events carousel.
- `src/components/person/profile-columns.tsx`: mobile profile carousel and desktop columns.
- `src/components/rich-text-columns.module.css`: profile carousel and column styles.
- `src/lib/poster-colors.ts`: shared palette.
- `tests/poster-layout.test.mjs`: rendered geometry regression.
