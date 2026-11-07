# Structured data and SEO audit

Audited on 2026-10-29 against the installed Next.js 16.4.2 guides and current Google Search documentation. The follow-up includes local rendered HTML checks and actual [Google Rich Results Test results](seo-google-validation.md). It does not establish Google indexing, rankings or eventual rich-result display.

## Fixed in this PR

1. **Event markup on the wrong page.** The calendar emitted JSON-LD for upcoming events even when those events were outside the selected calendar range. Event detail pages emitted none. Google requires an event's markup on its own unique detail URL. Eligible detail pages now emit Event and breadcrumb data; the calendar no longer fetches or emits unrelated event entities. [Google event guidelines](https://developers.google.com/search/docs/appearance/structured-data/event#technical-guidelines).

2. **Event data could contradict visible facts.** Week-only schedules produced exact dates when weekly slots existed. The schema preferred a CILAS place while the page preferred the external venue. A separate timezone calculation used the wrong Cairo offset beside the autumn clock change. Schema now uses the same venue precedence and Cairo time conversion as the page. Uncertain dates, missing detail URLs, virtual-only events and missing physical addresses omit Event markup. Agenda times use their earliest start and latest end. [Google event requirements](https://developers.google.com/search/docs/appearance/structured-data/event#structured-data-type-definitions).

3. **Malformed course instances.** Instances lacked `@type`, instructors were attached to Course rather than CourseInstance, and `courseSchedule` was a string instead of a Schedule. Empty delivery modes also invented an onsite instance. Instances are now typed, instructors belong to the instance, and unknown delivery information is omitted. Removed the invalid schedule property. The course-list summary/detail pairing remains intact. [CourseInstance](https://schema.org/CourseInstance), [courseSchedule](https://schema.org/courseSchedule), [Google course-list guidance](https://developers.google.com/search/docs/appearance/structured-data/course).

4. **Missing canonical and language links.** Most public routes had no canonical URL. Article and profile routes had language links without the sitemap's default-language entry. A shared helper now gives public pages a localized canonical plus English, Arabic and `x-default` alternates that agree with the sitemap. Study pagination keeps its page number and clamps invalid pages using the same catalogue result as the page. Search/filter variants emit noindex; calendar navigation variants canonicalize to the base calendar. [Localized versions](https://developers.google.com/search/docs/specialty/international/localized-versions).

5. **Generic catalogue metadata and incomplete event sharing data.** The study index inherited the generic CILAS title and description. It now uses its own title and visible introductory text. Events now use the configured SEO image, cover or site fallback consistently across Open Graph and Twitter. Course metadata reads also enforce Payload access with the current reader.

6. **Robots.txt prevented noindex discovery.** Login, signed-in and application routes were blocked from crawling, so Google could not read their page directives. Course and Bridge application pages also lacked noindex. Page routes are now crawlable; applications and the Spaces layout explicitly emit noindex. Admin and API crawl exclusions remain. [Google noindex guidance](https://developers.google.com/search/docs/crawling-indexing/block-indexing).

7. **Pagination depended on button handlers.** Study, article-index and event-archive pagination now exposes actual links with localized page URLs. Existing client interaction, modified clicks and disabled states are preserved. Article listing metadata and page rendering share page bounds and filter normalization. [Google crawlable-link guidance](https://developers.google.com/search/docs/crawling-indexing/links-crawlable).

8. **Rich-text internal links fell back to `#`.** Supported populated document targets now resolve in the reader's locale in full and plain presentations. Unavailable or unsupported relationships keep their text without an invented link. New-tab safety attributes and external links keep their existing behavior.

9. **Generic profile snippets.** Profiles now derive descriptions from the visible biography and share metadata from the person's title and photo.

## Verification

- The initial schema regression run reproduced `Tests 8 failed | 1 passed (9)`. The passing case already protected JSON-LD from script-tag injection.
- The final focused run passed 76 tests across 13 files. Coverage includes schemas, localized URLs, pagination, rich-text links, event timing, Cairo dates, calendar feeds, event cards and people revalidation. A separate existing movie-block assertion failure is documented in the [follow-up report](seo-google-validation.md).
- TypeScript and ESLint on changed code passed. The optimized production compilation passed with `pnpm build --experimental-build-mode compile`. Full production prerendering was not run.
- The expanded `test:seo` run validated all 1,238 local sitemap entries and checked the server-rendered HTML of 44 sampled public pages, including page-two links, profile snippets and eligible event detail pages, plus both locales' login and signed-in noindex directives. This is a sample crawl, not a crawl of all 1,238 pages. The script supports `--all` for a full crawl and `--path=` for extra samples against a running app whose configured public origin matches the supplied origin.
- Additional requests confirmed page-two canonicals in both locales, noindex on search/filter variants and the Bridge application page, and the base canonical on calendar navigation variants.
- The local server used the existing development Postgres at localhost:5433 and dummy external-service settings. No production configuration or data changed.

To rerun the focused suite:

```sh
DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_dev pnpm exec vitest run \
  tests/unit/schema.unit.spec.tsx tests/unit/seo.unit.spec.ts \
  tests/unit/sitemap.unit.spec.ts tests/unit/events.unit.spec.ts \
  tests/unit/ics.unit.spec.ts tests/unit/cairo-day.unit.spec.ts \
  tests/unit/revalidation-paths.unit.spec.ts \
  tests/unit/public-event-card.unit.spec.tsx tests/unit/public-event-cover.unit.spec.ts \
  tests/unit/seo-links.unit.spec.tsx tests/unit/rich-text-columns.unit.spec.tsx \
  tests/unit/person-profile-block.unit.spec.tsx tests/unit/blog-grid-cards.unit.spec.tsx
```

## Remaining findings and checks

1. **Optional structured content.** Google's non-critical warnings identify separate city/postal-code properties and missing event performer, offers and status fields. These need accurate structured content rather than guessed values. Local sample image/URL warnings are documented separately from the successful public homepage logo check.
2. **Deployment validation.** The configured app is `https://cilas.salahmohsen.com`, whose homepage Google crawled successfully. Earlier 404 responses at `https://ci-las.org` concerned a different hostname. The PR branch has not been deployed; validate its public detail URLs after deployment.
3. **Search Console and performance checks.** Four representative page types passed Google's Code-mode test. Confirm the sitemap and inspect deployed URLs in Search Console, then check real mobile Core Web Vitals separately. Search Console data and browser performance measurements were not available in this audit.

The script checks metadata, JSON syntax and selected schema contracts. It does not replace Google's Rich Results Test or the [Schema Markup Validator](https://validator.schema.org/). Correct markup alone does not guarantee a rich result. [Google structured-data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies).
