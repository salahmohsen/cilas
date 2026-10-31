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
| Open registration | `src/components/home/poster-carousel.tsx`   | `100cqw` (the page frame)            | Yes      |
| Events            | `src/components/events/event-carousel.tsx`  | `min(84cqw, 28rem)`; 3 up from 900px | No       |
| Articles          | `src/components/home/home-articles.tsx`     | `min(84cqw, 420px)`                  | Yes      |
| People profiles   | `src/components/person/profile-columns.tsx` | `88cqw`, below `48rem` only          | No       |

### People-profile columns

Columns that contain person-profile blocks use the Arc carousel below `48rem`, one column per slide. Previous, next, indicators, keyboard, and dragging give manual navigation. At wider widths the same content uses the column count and ratio. The server renders the column layout; the mobile client switches to Arc after hydration. Do not render two sets of profile cards for the two layouts. Keep custom profile converters, public-profile visibility checks, and bio previews intact.

## 6. Shared palette and images

`POSTER_COLORS` in `src/lib/poster-colors.ts` holds the registration and avatar palette: yellow `#ffb71b`, blue `#1782ea`, pink `#ff7d9d`, green `#12d08f`. Registration posters take their color from this array unless a color is supplied. Generated Beam avatars pass the same array to the library's `colors` option; the library still draws faces in black or white. Uploaded photos have priority, and the person's stable seed selects the generated portrait.

Registration covers use `imageDelivery: 'direct'` on `PosterData`. Payload already stores uploads as WebP, so this avoids a second runtime transform and the upstream fetch timeouts seen in production. Direct delivery has no responsive `srcset`, so keep uploads to a sensible size. Other posters keep Next.js image optimization unless they opt in.

The registration carousel loads the active and next image eagerly, gives only the active image high fetch priority, and loads the rest lazily. Failed covers fall back to a local classroom image, or the logo when the poster asks for it. Fallback images do not reuse the original alt text or focal point.

## 7. The poster look

Sections 1 to 6 decide sizes. This section decides how a CILAS card looks, so another element (the fellow cards in Who teaches it, for example) reads as part of the same family as the registration posters. Copy these values; do not approximate them.

### Materials

| Token            | Value                                                          | Use                                                        |
| ---------------- | -------------------------------------------------------------- | ---------------------------------------------------------- |
| `--poster-ink`   | `#121212`                                                      | Every rule, the outline, and all text on the card.         |
| `--poster-paper` | `#ffffff`                                                      | Paper cells: labels, credits, bios, the mark, the details. |
| `--poster-color` | One of `POSTER_COLORS`                                         | Colour cells: the title panel, the date, the action.       |
| `--poster-pad`   | `clamp(0.875rem, 2.2cqi, 1.5rem)`                              | The one inset for every cell, so all text shares edges.    |
| Outline          | `1px solid var(--poster-ink)`, `1rem` radius, `overflow: clip` | The card's edge. Nothing else is rounded inside it.        |

A card is a printed thing: it stays ink on paper in the dark theme. Do not swap these tokens for theme tokens, and set `color: var(--poster-ink)` on links inside it, or theme link colours turn invisible on paper.

### Colour

- One flat colour per card from `POSTER_COLORS` (`src/lib/poster-colors.ts`). In a list, cycle by position (`POSTER_COLORS[index % 4]`) so neighbours differ. Pass it as the inline `--poster-color` custom property.
- No gradients, tints, shadows, or transparency. A cell is either paper or the card's colour.
- Text on a colour cell is always ink. Ink on all four colours passes WCAG AA for large text; keep body-size text on paper.
- Generated avatars draw from the same four colours (section 6), so a person without a photo still matches the card.

### Cells and rules

The card is a stack of boxes divided by 1px ink rules. Each rule has one owner (rule 9):

1. **Media cell**: the photo or poster image, `object-fit: cover` with the focal point. Its rule faces the text: `border-block-end` when stacked, `border-inline-end` (or `-start` for image-after layouts) when side by side.
2. **Title panel**: the card's colour, holding the title. When the card is wider than its content needs, this panel takes the spare width or height (the title-owns-spare-space policy).
3. **Paper cells** on the panel: label above the title (owns its lower rule), credit or bio below it (owns its upper rule).
4. **Strip** at the foot: a grid of cells in one row. The strip owns the rule above it; each cell owns the rule at its inline end, and the action owns the rule at its start. Order: the CILAS mark on paper, then supporting facts (a date in the colour cell, details or a role on paper), then the action in the colour cell.

### Type

- Title: `var(--font-playfair-display), var(--font-amiri), serif`, weight 700, `line-height: 1.1`, `letter-spacing: -0.025em`, `text-wrap: balance`, size from the card's container (`clamp(1.75rem, 5cqi, 3rem)` for profile cards, up to `3.75rem` for posters). In Arabic (`:dir(rtl)`): `line-height: 1.35`, no letter spacing.
- Label: `var(--font-heading)`, regular, `clamp(1.25rem, 3.4cqi, 2.5rem)`, `line-height: 1.05`.
- Strip text: `clamp(0.75rem, 1.4cqi, 0.9375rem)`; the action is weight 600 with an arrow that flips in RTL.
- Long text (a bio) sits on paper at the page's reading size, `line-height: 1.7`, ink at 82% on paper, `max-width: 68ch`.

### Notice row

A notice that people must not miss (the fellows' note: fees, travel, forms) closes the card, just above the strip. Its heading row is a white label box (paper, ink rule at its inline end, body font at 700) beside a band of still hazard stripes: `repeating-linear-gradient(-45deg, colour 0 1.125rem, ink 1.125rem 1.875rem)` in the card's own colour. The stripes do not move. The notice text sits below on paper in the same face, size, and colour as the bio, and owns no extra rule. This band is the one patterned surface allowed on a card; use it only for a notice.

### Behaviour

- The title enters with Arc's `InViewTitle` (`variant="line"`, `once={false}`), the same entrance as the poster titles. Wrap it in a `dir="auto"` element that carries the title's type, and set `font: inherit` on the heading it renders.
- The image scales to 1.03 on hover with a fine pointer, and not at all with reduced motion.
- Keyboard focus on the action or card link: `outline: 3px solid var(--poster-ink)` with `outline-offset: -3px`, inside the outline.
- Compose from the card's container width, not the viewport: stacked below `34rem`, side by side above it.

### Reference implementations

| Element             | Markup                                                    | Styles (`src/app/(frontend)/styles.css`) |
| ------------------- | --------------------------------------------------------- | ---------------------------------------- |
| Registration poster | `src/components/home/poster.tsx`                          | `.poster*`                               |
| Fellow card         | `src/app/(frontend)/[locale]/study/[slug]/CourseView.tsx` | `.fellow-card*`                          |

The fellow card maps the poster like this: photo (media cell, 4:3 when stacked; when wide, a square at the top of a `min(36%, 18rem)` column, with the card's colour filling the column under it when the text is taller, so the photo is never stretched), name on the colour panel, the bio as a paper cell under the name, the fellows' note ("From the fellow") as the notice row, and a strip with the mark, the role, and "View profile". The note is course-level: with one fellow it closes that card; with several it gets its own card after theirs, in the next palette colour. Content sizes the card; nothing shares a height with a neighbour.

## 8. Verification

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

## 9. Lessons from past bugs

- **Yellow mobile gap.** The carousel stretched slides to a shared height, but at the stacked breakpoint `.poster-panel` had `flex: none` and the image kept its aspect ratio. Spare height collected below the panel, white like the fellow cell and without a rule, so it looked like an oversized fellow box. `flex: none` on the fellow could not fix a parent's sizing. Fix: the image owns spare height (rule 2).
- **Cut corners in carousels.** The viewport clipped with `--radius-panel` over the poster's smaller radius. Fix: `--carousel-viewport-radius: 0px` (rule 10).
- **Timer overflow.** The countdown kept its animated inline width. Fix: natural dimensions and wrapping unit groups (rules 11 to 13).

## 10. Applying this to a new element

1. Write the content hierarchy and choose the spare-space owner (section 1).
2. Reuse `Poster` when its semantics fit. Otherwise follow section 3, and give it the poster look (section 7).
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
- `src/app/(frontend)/[locale]/study/[slug]/CourseView.tsx`: fellow cards in Who teaches it, in the poster look (section 7); content sizes all; the `fellow-card` container switches at `34rem`.

## 11. Wide blocks in prose

A Columns block inside article, course, or event prose grows past the reading measure to the page's main column on screens from `64rem`. The page marks that column with `prose-frame` (an inline-size container). The prose must be centered in the frame, because the block grows by the same amount on both sides: `margin-inline: max(-16rem, min(0px, (100% - 100cqi) / 2))`. Below `64rem` the columns stay inside the prose and stack on phones. A size container takes no width from its content, so give a `prose-frame` an explicit `width: 100%` when it has auto margins.
