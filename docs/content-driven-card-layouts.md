# Content-driven card layouts

Use this guide when adapting the Open for registration cards to other elements in CILAS. The central decision is **which region receives spare space**. Make that decision explicit for each layout, then keep supporting text sized to its content.

## The registration card contract

The image establishes the subject. The course title is the primary text. Course type, fellow names, dates, and actions support it.

| Region                          | Sizing responsibility                                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Image                           | Start at the chosen aspect ratio on stacked cards, then absorb spare card height; crop using the saved focal point. |
| Course type                     | Text height plus shared padding and a divider.                                                                      |
| Course title                    | Natural text height on stacked cards; fill spare space inside a taller side panel on wide cards.                    |
| Fellow names                    | Text height plus shared padding and a divider; wrap when needed.                                                    |
| Closing date                    | Content-sized width with padding; wrap within its bounded column when needed.                                       |
| Time left                       | Fill the rest of the date's row; center its content horizontally and vertically.                                    |
| Registration details and action | Content-sized rows; allow wrapping or a deliberate second row.                                                      |

“Fit the text” means the text's line boxes **plus padding and borders**. It does not mean removing the breathing room around a name. A longer name or several fellows must make the cell taller naturally.

When a carousel makes stacked cards as tall as the tallest slide, the image receives the extra height. The label, title, fellows, and footer stay content-sized. Without an imposed shared height, the card follows its content. On wide cards, image and text sit side by side; the title can fill spare height inside the side panel.

## What caused the yellow mobile bug

The carousel stretches its slides to a shared height. At the stacked breakpoint, `.poster-panel` used `flex: none`, so it stopped after its text. The yellow image also stayed at its aspect ratio. Spare height remained below the panel inside `.poster-body`.

That empty area had the same white background as the fellow cell and no separating rule. It looked like an oversized fellow box even though `.poster-credit` itself was content-sized. Setting `flex: none` on the fellow again could not fix its ancestor's sizing.

The current layout gives the spare stacked-card height to the image. The text panel stops after its content and sits directly against the footer or card edge, so there is no unused white area below the fellow. `flex: 1` on `.poster-title` only distributes space available inside its heading; it does not make the outer image grow. The panel's sizing decides whether any external spare height reaches that title.

The closing-date and time-left cells stay next to each other at every breakpoint. The date column fits its content; the timer column receives the remaining row width. Its countdown wrapper uses natural dimensions instead of its animated inline width and height, and the timer is centered horizontally and vertically. Unit groups and their labels can wrap inside that cell without clipping. Digit animation stays inside each wheel. Treat text cells as content-sized regions rather than assigning them a shared fixed height.

## Approved rules for future changes

Use these as acceptance criteria when applying this design elsewhere. Update this file with each approved correction so the examples and tests continue to describe the current design.

1. On stacked cards, labels, titles, fellows, dates, and actions determine their own height. The image receives spare card height.
2. A fellow cell fits the name or names plus padding. It never absorbs unused card height.
3. The closing date and countdown remain adjacent. Do not move the timer to a full-width row to fix overflow.
4. The date box fits its content; the timer fills the remainder and centers its content in both axes.
5. When space gets tight, allow text and timer groups to wrap within their existing boxes and let the row grow vertically. Preserve readable type and the declared neighbors.
6. Own each separator once. Keep the rule between the date and timer, including on mobile and in RTL.
7. Changing a breakpoint must preserve these sizing responsibilities. Color and poster placement do not change them.
8. Verify the rendered geometry for these rules, not just the presence of CSS classes. Keep the guide, implementation, and tests in agreement.
9. Registration posters and generated person avatars share the palette in `src/lib/poster-colors.ts`. Pass it to Boring Avatars through its built-in `colors` prop; keep stable seeds and uploaded-photo precedence.
10. Each card owns its rounded outline. A carousel viewport must not apply a larger rounded clipping shape over the card's corners.
11. People-profile columns use Arc's carousel on mobile with manual navigation and automatic rotation disabled. Keep the desktop column layout.

### Closing-date row recipe

Use a grid equivalent to a content-sized label followed by a flexible remainder. `minmax(0, 1fr)` is the grid counterpart of giving the timer `flex: 1` with a zero minimum width:

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

The first column is the mark, the second is the date, and the third is the timer. The date uses its natural width up to a 40% ceiling, protecting timer space in narrow containers. A longer date wraps rather than pushing the timer outside the card. Wide CILAS posters also reserve 62% for their details/action column, so their date ceiling is 19% of the full strip. A strip without a timer uses a separate two-column layout on mobile. These percentages belong to this composition; preserve the content-sized-date/flexible-timer contract when adapting it.

Centering the timer box is not enough if its nested widget keeps a fixed animated width or a non-wrapping minimum width. Keep the wrapper and inner content shrinkable, let unit groups wrap when necessary, and test the digits themselves against the cell bounds.

## Assign one owner of spare space

Choose the policy from the content's purpose, independently of its color:

- **Title receives spare space:** text-led tiles, or the inside of a wide registration side panel with supporting credits.
- **Image receives spare space:** stacked registration and event posters whose text panels stop after their content.
- **Content determines all heights:** independent cards without a shared-height requirement.

Flexbox distributes available space among flexible children; `flex: none` prevents growth and shrinkage. These sizing behaviors are defined in the [W3C Flexbox specification](https://www.w3.org/TR/css-flexbox-1/#flex-common).

Do not give both the image and title independent growth rules unless sharing the extra height is intentional. Do not stretch names, labels, or metadata to compensate for a missing growth rule on a parent.

## Reusable implementation pattern

The following is a suggested contract for future components, **not an API currently implemented by `Poster`**. Use a semantic input such as `spaceOwner: 'title' | 'media'`, rendered as a data attribute. Keep content, color, and placement as separate inputs.

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

This example describes the stacked layout. Add a container query for side-by-side placement when its actual content fits. Every wrapper between the stretched body and the growing title must pass the available height onward. A growing child cannot claim space that its parent never receives.

Prefer explicit flex values in reusable primitives. `flex: 1` commonly expands to a percentage basis in browsers; percentage bases can resolve differently when the container's main size is indefinite. See [MDN's explanation of flex sizing](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Flexible_box_layout/Controlling_flex_item_ratios).

## Adapt to the container and content

Use the card's container width to choose its composition. A card in a narrow desktop column may need the same stacked layout as a mobile card. CILAS posters use a named `poster` container and switch at `34rem`; that threshold belongs to this composition, not every future card. See [MDN's container query guide](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Containment/Container_size_and_style_queries).

Keep fixed heights off text cells. Use image aspect ratios where a consistent crop is useful, and let longer content increase the overall card height. Container-relative type sizes can use `clamp()` with readable lower and upper bounds, but check the longest real title at the narrowest side-panel width.

Use the app's loaded font weights. The poster title currently uses bold Playfair Display for Latin and IBM Plex Sans Arabic for Arabic, with a larger line height for Arabic. Do not request a bold weight from a face that only supplies regular and assume it will render correctly.

Use logical spacing and borders (`padding-inline`, `border-block-start`, `border-inline-end`). Set the appropriate document language and `dir="auto"` on mixed-language text. Preserve the intended reading order when the layout changes. Do not split names or truncate course titles simply to keep a height constant; define any exceptional long-token wrapping policy deliberately.

## Make boxes read as one system

### Shared palette

`POSTER_COLORS` in `src/lib/poster-colors.ts` is the shared registration and avatar palette: yellow `#ffb71b`, blue `#1782ea`, pink `#ff7d9d`, and green `#12d08f`. Registration `Poster` instances set their color from that array unless a specific color is supplied. Generated Beam avatars pass the same array to the library's built-in `colors` option. The library still draws facial details in black or white. Uploaded photos keep priority, and the stable person seed continues to determine the generated portrait.

### Rounded corners inside carousels

Registration and profile cards clip their own content to their rounded border. Arc's viewport also clips the horizontal track, but its default panel radius is larger than the poster radius. Applying both shapes at the same edge can cut away the card's border corners on mobile.

The local Arc carousel supports `--carousel-viewport-radius`, falling back to its usual `--radius-panel`. Poster and profile carousels set that viewport radius to `0px`: the viewport still clips horizontal slide overflow, while each card draws and clips its own rounded shape. Other Arc carousels keep their default radius. Check all four card corners with real rendered hit testing, not just the computed `border-radius` value.

### People-profile columns

Columns containing person-profile blocks use the existing Arc carousel below `48rem`, with one column per slide at `88cqw`. The previous and next buttons, indicators, keyboard controls, and dragging provide manual navigation. No rotation interval is supplied and autoplay is disabled, so there is no play/pause rotation control. Carousel navigation runs left to right while each profile's text retains its own language direction.

At wider widths the same content uses the existing column count and ratio. The server-rendered column layout remains available before hydration; the mobile client switches to Arc. Do not render duplicate sets of profile cards to implement the two presentations. Keep custom profile converters, public-profile visibility checks, and bio previews intact.

Use a shared padding token so labels, titles, fellow names, and footer text align. Give each internal boundary one owner: for example, the panel owns the image-to-text border, the course-type cell owns its lower rule, and the fellow cell owns its upper rule. Avoid doubled borders and unbordered blank areas that visually merge with adjacent cells.

Keep the title visually stronger than the course type and fellow. Keep actions recognizable, keyboard reachable, and visibly focused. A card-wide link must not cover independent links such as a venue map. Image focal points, missing images, reduced motion, and translated labels are part of the component's behavior.

## Verification before reuse

### Image delivery

Registration covers use `imageDelivery: 'direct'` on `PosterData`: Payload has already converted uploaded media to WebP. This avoids a second runtime image transform and the upstream-fetch timeouts observed in production. Direct delivery uses the stored file's resolution and byte size; it does not generate a responsive `srcset`. Keep uploads appropriately sized. Other poster types retain Next.js image optimization unless they explicitly choose direct delivery.

The registration carousel loads its active and next image eagerly, gives only the active image high fetch priority, and leaves the other images lazy. This prepares the next transition without eagerly downloading every slide. Failed covers use a local classroom image, or the logo when that poster requests it. Fallback images do not reuse the original artwork's alt text or focal point.

### Layout checks

Test the full sizing chain, including a taller neighboring card. An isolated card can look correct while the carousel version fails.

- Narrow, medium, and wide containers, including both sides of the composition breakpoint.
- Short and long titles; one fellow, several fellows, and no fellow.
- English, Arabic, and mixed-direction names.
- Larger text, 200% zoom, and narrow reflow without clipped text or unreachable actions.
- Missing images, different focal points, and wrapped footer details.
- Equal-height carousel slides and independent content-height cards.

For title-led cards, assert that adding height to a neighboring slide increases the title region, leaves an unchanged fellow's cell height unchanged, and creates no empty area below that cell. For image-led cards, assert the corresponding image growth while the title panel remains content-sized. Use rendered geometry for these checks; DOM-only unit tests cannot measure CSS layout.

The registration regression test uses the real poster stylesheet in Chromium with isolated markup matching its sizing structure:

```sh
pnpm exec playwright install chromium
node --test tests/poster-layout.test.mjs
```

It covers the three effective poster placements at 288, 358, 528, and 960 CSS pixels, with English, Arabic, wrapped fellows, and missing fellows. On stacked cards it checks image growth and stable text heights; on wide cards it checks title growth inside the side panel. It also checks the pink card's countdown at widths from 240 to 960 pixels in both directions and with larger text, including a stale inline animation size. The date and timer must share a row, the date must fit its content when space allows, and the timer must occupy the remaining width with centered, visible content. It checks layout allocation rather than production fonts, actual images, live countdown transitions, carousel animation, or a deployed page; those need a separate visual pass when changed. CI runs this geometry test in the production-smoke job after installing Chromium.

## Where to apply this in CILAS

- `src/components/home/poster.tsx`: shared markup and registration marker.
- `src/components/home/open-now.tsx`: registration content and poster data.
- `src/app/(frontend)/styles.css`: poster sizing, container queries, typography, and dividers.
- `src/components/home/poster-carousel.tsx`: carousel integration.
- `src/lib/poster-colors.ts`: shared registration and generated-avatar palette.
- `src/components/person/profile-columns.tsx`: mobile Arc carousel and desktop profile columns.
- `tests/poster-layout.test.mjs`: rendered geometry regression.

For a new element, first write its content hierarchy, choose its spare-space owner, and identify which fields are optional. Reuse the existing poster when its semantics fit. Introduce a shared sizing primitive only when another real component needs the same contract; changing this guide does not require building a universal card engine.
