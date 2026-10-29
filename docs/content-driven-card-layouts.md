# Content-driven card layouts

Use this guide when adapting the Open for registration cards to other elements in CILAS. The central decision is **which region receives spare space**. Make that decision explicit for each layout, then keep supporting text sized to its content.

## The registration card contract

The image establishes the subject. The course title is the primary text. Course type, fellow names, dates, and actions support it.

| Region                          | Sizing responsibility                                                                         |
| ------------------------------- | --------------------------------------------------------------------------------------------- |
| Image                           | Keep the chosen aspect ratio on stacked registration cards; crop using the saved focal point. |
| Course type                     | Text height plus shared padding and a divider.                                                |
| Course title                    | Natural text height, then any spare panel height.                                             |
| Fellow names                    | Text height plus shared padding and a divider; wrap when needed.                              |
| Registration details and action | Content-sized rows; allow wrapping or a deliberate second row.                                |

“Fit the text” means the text's line boxes **plus padding and borders**. It does not mean removing the breathing room around a name. A longer name or several fellows must make the cell taller naturally.

When a carousel makes cards as tall as the tallest slide, the registration title receives the extra height. Without an imposed shared height, the card follows its content; do not create empty title space just to imitate a screenshot.

## What caused the yellow mobile bug

The carousel stretches its slides to a shared height. At the stacked breakpoint, `.poster-panel` used `flex: none`, so it stopped after its text. The yellow image also stayed at its aspect ratio. Spare height remained below the panel inside `.poster-body`.

That empty area had the same white background as the fellow cell and no separating rule. It looked like an oversized fellow box even though `.poster-credit` itself was content-sized. Setting `flex: none` on the fellow again could not fix its ancestor's sizing.

The fix lets stacked registration panels grow, keeps their images at the chosen aspect ratio, and passes the extra height through `.poster-heading` to `.poster-title`. The fellow remains content-sized. The change is scoped to registration posters marked `data-separate-label`; event cards keep their own image-led space allocation.

## Assign one owner of spare space

Choose the policy from the content's purpose, independently of its color:

- **Title receives spare space:** registration cards, course summaries, or text-led tiles with supporting credits.
- **Image receives spare space:** event posters or other image-led cards whose title panel should stop after its text.
- **Content determines all heights:** independent cards without a shared-height requirement.

Flexbox distributes available space among flexible children; `flex: none` prevents growth and shrinkage. These sizing behaviors are defined in the [W3C Flexbox specification](https://www.w3.org/TR/css-flexbox-1/#flex-common).

Do not give both the image and title independent growth rules unless sharing the extra height is intentional. Do not stretch names, labels, or metadata to compensate for a missing growth rule on a parent.

## Reusable implementation pattern

The following is a suggested contract for future components, **not an API currently implemented by `Poster`**. Use a semantic input such as `spaceOwner: 'title' | 'media'`, rendered as a data attribute. Keep content, color, and placement as separate inputs.

```html
<div class="card-frame">
  <article class="content-card" data-space-owner="title">
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

Use a shared padding token so labels, titles, fellow names, and footer text align. Give each internal boundary one owner: for example, the panel owns the image-to-text border, the course-type cell owns its lower rule, and the fellow cell owns its upper rule. Avoid doubled borders and unbordered blank areas that visually merge with adjacent cells.

Keep the title visually stronger than the course type and fellow. Keep actions recognizable, keyboard reachable, and visibly focused. A card-wide link must not cover independent links such as a venue map. Image focal points, missing images, reduced motion, and translated labels are part of the component's behavior.

## Verification before reuse

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

It covers the three effective poster placements at 288, 358, 528, and 960 CSS pixels, with English, Arabic, wrapped fellows, and missing fellows. It checks layout allocation rather than production fonts, actual images, carousel animation, or a deployed page; those need a separate visual pass when changed. CI runs this geometry test in the production-smoke job after installing Chromium.

## Where to apply this in CILAS

- `src/components/home/poster.tsx`: shared markup and registration marker.
- `src/components/home/open-now.tsx`: registration content and poster data.
- `src/app/(frontend)/styles.css`: poster sizing, container queries, typography, and dividers.
- `src/components/home/poster-carousel.tsx`: carousel integration.
- `tests/poster-layout.test.mjs`: rendered geometry regression.

For a new element, first write its content hierarchy, choose its spare-space owner, and identify which fields are optional. Reuse the existing poster when its semantics fit. Introduce a shared sizing primitive only when another real component needs the same contract; changing this guide does not require building a universal card engine.
