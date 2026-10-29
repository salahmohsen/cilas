# Structured data and SEO audit

Audited on 2026-10-29 against the installed Next.js 16.4.2 guides and current Google Search documentation. This is an implementation audit with local rendered HTML checks. It does not establish Google indexing, rankings or rich-result eligibility.

## Fixed in this PR

1. **Event markup on the wrong page.** The calendar emitted JSON-LD for upcoming events even when those events were outside the selected calendar range. Event detail pages emitted none. Google requires an event's markup on its own unique detail URL. Eligible detail pages now emit Event and breadcrumb data; the calendar no longer fetches or emits unrelated event entities. [Google event guidelines](https://developers.google.com/search/docs/appearance/structured-data/event#technical-guidelines).

2. **Event data could contradict visible facts.** Week-only schedules produced exact dates when weekly slots existed. The schema preferred a CILAS place while the page preferred the external venue. A separate timezone calculation used the wrong Cairo offset beside the autumn clock change. Schema now uses the same venue precedence and Cairo time conversion as the page. Uncertain dates, missing detail URLs, virtual-only events and missing physical addresses omit Event markup. Agenda times use their earliest start and latest end. [Google event requirements](https://developers.google.com/search/docs/appearance/structured-data/event#structured-data-type-definitions).

3. **Malformed course instances.** Instances lacked `@type`, instructors were attached to Course rather than CourseInstance, and `courseSchedule` was a string instead of a Schedule. Empty delivery modes also invented an onsite instance. Instances are now typed, instructors belong to the instance, and unknown delivery information is omitted. Removed the invalid schedule property. The course-list summary/detail pairing remains intact. [CourseInstance](https://schema.org/CourseInstance), [courseSchedule](https://schema.org/courseSchedule), [Google course-list guidance](https://developers.google.com/search/docs/appearance/structured-data/course).

4. **Missing canonical and language links.** Most public routes had no canonical URL. Article and profile routes had language links without the sitemap's default-language entry. A shared helper now gives public pages a localized canonical plus English, Arabic and `x-default` alternates that agree with the sitemap. Study pagination keeps its page number and clamps invalid pages using the same catalogue result as the page. Search/filter variants emit noindex; calendar navigation variants canonicalize to the base calendar. [Localized versions](https://developers.google.com/search/docs/specialty/international/localized-versions).

5. **Generic catalogue metadata and incomplete event sharing data.** The study index inherited the generic CILAS title and description. It now uses its own title and visible introductory text. Events now use the configured SEO image, cover or site fallback consistently across Open Graph and Twitter. Course metadata reads also enforce Payload access with the current reader.

6. **Robots.txt prevented noindex discovery.** Login, signed-in and application routes were blocked from crawling, so Google could not read their page directives. Course and Bridge application pages also lacked noindex. Page routes are now crawlable; applications and the Spaces layout explicitly emit noindex. Admin and API crawl exclusions remain. [Google noindex guidance](https://developers.google.com/search/docs/crawling-indexing/block-indexing).

## Verification

- The initial schema regression run reproduced `Tests 8 failed | 1 passed (9)`. The passing case already protected JSON-LD from script-tag injection.
- The final focused run passed 49 tests across nine files. Coverage includes schemas, localized URL agreement with the sitemap, event timing, Cairo dates, calendar feeds, event cards and people revalidation.
- TypeScript and ESLint on changed code passed. The optimized production compilation passed with `pnpm build --experimental-build-mode compile`. Full production prerendering was not run.
- `pnpm test:seo http://localhost:3037` validated all 1,238 local sitemap entries and checked the server-rendered HTML of 32 sampled public pages, plus both locales' login and signed-in noindex directives. This is a sample crawl, not a crawl of all 1,238 pages. The script supports `--all` for a full crawl against a running app whose configured public origin matches the supplied origin.
- Additional requests confirmed page-two canonicals in both locales, noindex on search/filter variants and the Bridge application page, and the base canonical on calendar navigation variants.
- The local server used the existing development Postgres at localhost:5433 and dummy external-service settings. No production configuration or data changed.

To rerun the focused suite:

```sh
DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_dev pnpm exec vitest run \
  tests/unit/schema.unit.spec.tsx tests/unit/seo.unit.spec.ts \
  tests/unit/sitemap.unit.spec.ts tests/unit/events.unit.spec.ts \
  tests/unit/ics.unit.spec.ts tests/unit/cairo-day.unit.spec.ts \
  tests/unit/revalidate-people.unit.spec.ts \
  tests/unit/public-event-card.unit.spec.tsx tests/unit/public-event-cover.unit.spec.ts
```

## Remaining findings and checks

1. **Medium. Crawlable pagination.** StudyList and BlogGrid navigate pages through button handlers. They should expose actual page links with `href` while retaining their existing interaction. The sitemap already exposes public documents, but listing pagination does not provide normal crawler navigation. [Google crawlable-link guidance](https://developers.google.com/search/docs/crawling-indexing/links-crawlable).
2. **Medium. Rich-text internal links.** Local editor fixtures produced Payload warnings about internal links without `internalDocToHref`. RichTextField does not configure that resolver. A separate renderer change should resolve supported document routes in the current locale and test unavailable or restricted relationship targets. Production prevalence was not measured.
3. **Low. Profile snippets.** Profile pages have unique titles and ProfilePage markup but still inherit the generic site description. Derive a short description from the visible biography when one exists.
4. **Deployment validation.** Requests to `https://ci-las.org` returned 404 for localized app paths, robots.txt and sitemap.xml. That hostname has not been confirmed as the current app deployment, so this is not attributed to the app implementation. Confirm the deployment origin before testing live URLs.
5. **Google and performance checks.** After deployment, run representative event, course, article and profile URLs through the [Rich Results Test](https://search.google.com/test/rich-results), confirm the sitemap and inspect URLs in Search Console. Check real mobile Core Web Vitals separately. No live Google validation, Search Console data or browser performance measurements were available in this audit.

The script checks metadata, JSON syntax and selected schema contracts. It does not replace Google's Rich Results Test or the [Schema Markup Validator](https://validator.schema.org/). Correct markup alone does not guarantee a rich result. [Google structured-data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies).
