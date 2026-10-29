# Google structured-data validation

Checked on 2026-10-29 with Google's Rich Results Test in a browser.

## PR markup in Code mode

Submitted JSON-LD from locally rendered pages together with their main content. The JSON-LD was unchanged; application scripts and styles were excluded. These tests validate the PR's markup without deploying the branch or asking Google to crawl localhost.

- [Course result](https://search.google.com/test/rich-results/result?id=0NW6rzhLNEwes9_6pz9NoA). Source `/en/study/world-cinema`. Three valid items: Course list item, Breadcrumbs and Organization.
- [Article result](https://search.google.com/test/rich-results/result?id=h9yJ7Q2nMAlaT64Z33KY_Q). Source `/en/articles/dev-editor-city-in-conversation`, a local editor fixture. Three valid items: Articles, Breadcrumbs and Organization.
- [Profile result](https://search.google.com/test/rich-results/result?id=xwr88pWgeIArTUZUSoVcLw). Source `/en/people/omar-hesham`. Three valid items: Profile page, Breadcrumbs and Organization.
- [Event result](https://search.google.com/test/rich-results/result?id=ZQmWxznLl-VbPb7-dm4mRQ). Source `/en/events/faces-1968-screening`. Three valid items: Events, Breadcrumbs and Organization.

All four tests passed without critical errors. Google reported non-critical warnings:

- Local `localhost` logo, image and event URLs are not public URLs. This is a limitation of the local samples. The live homepage's public logo passed Google's URL validation.
- Organization addresses do not have separate `addressLocality` and `postalCode` properties. The current place model supplies its full address as one string. These are optional fields; splitting arbitrary address text automatically would risk inaccurate data.
- The sampled event has no performer, offers or eventStatus properties. Google marks these optional. The schema does not invent ticket prices, performers or cancellation information that the event record does not supply.

Google's result links are point-in-time test evidence. They do not establish indexing, ranking or eventual rich-result display.

## Live URL test

Confirmed the configured application hostname through the connected hosting configuration, then submitted `https://cilas.salahmohsen.com/en` to Google's URL test.

[Live homepage result](https://search.google.com/test/rich-results/result?id=gQuR5h7qZ28GipMt5d7j5A). Google crawled it successfully and detected one valid Organization item. The only warnings were the optional `addressLocality` and `postalCode` fields. The public logo was accepted.

This checks the existing deployment. The PR changes have not been deployed. Their live detail URLs still need a URL-mode check after merge and deployment. Search Console indexing and Core Web Vitals were not measured.

## Remaining code findings

The three findings from the initial audit are fixed:

- Study, article-index and event-archive pagination exposes real page links. Ordinary clicks keep the existing client interaction; modified clicks retain browser behavior. In-place grids keep their button controls. Article metadata and displayed pages share bounds and filter normalization.
- Rich-text internal links use the current locale and supported document routes. Unpopulated, unsupported, hidden, owner-only and draft targets retain their text without an invented URL. Existing access checks still control which relationships are populated.
- Profile titles, descriptions and share metadata use the person's visible biography and photo when available.

The expanded rendered checker also follows page-two links, checks biography descriptions and accepts additional `--path=` samples. It passed for 44 sampled public pages and validated all 1,238 local sitemap entries.

```sh
pnpm test:seo http://localhost:3037 \
  --path=/en/events/faces-1968-screening \
  --path=/ar/events/faces-1968-screening
```

The focused suite passed 76 tests across 13 files. A separate movie-block suite has one existing failure: it expects a `<details>` cast section that the current MovieCard does not render. The same assertion failed with the pre-change RichTextField restored; five other movie tests passed. No movie UI or test assertions were changed to hide that failure.
