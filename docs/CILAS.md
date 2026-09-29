---
Date: 2026-09-29
Status: Baby
tags:
  - cilas-project
Reference: https://www.ci-las.org/
---

# CILAS — Website Revamp Plan

Rebuild ci-las.org (Weebly) on Next.js + Payload, preserving CILAS' voice — a pedagogy of discovery and attunement, not a corporate brochure.

## 1. Summary

CILAS (Cairo Institute of Liberal Arts and Sciences) offers a one-year liberal arts bridge programme plus seasonal courses, labs, and workshops to students "from all walks of life".

The revamp migrates 10 years of content (21 cycles, ~150 courses, 171 PDF syllabi, people, press) into a bilingual AR/EN Payload CMS with a live calendar, structured syllabi (not PDFs), and community-authored articles.

Key decisions: current course taxonomy (Bridge / Core / Thematic / Lab / Workshop); session-by-session syllabi; articles with draft → community → public workflow; fully automated AI migration. Full field schemas: [[CILAS-schema]].

## 2. Stack & infra

| Layer | Choice | Notes |
| --- | --- | --- |
| App | **Next.js + Payload v3** | single app, headless CMS + admin |
| Host | **Vercel** | zero-ops |
| DB | **Neon** (serverless Postgres) | `@payloadcms/db-postgres` |
| Media | **Cloudflare R2** | 10 GB free, zero egress, `@payloadcms/storage-s3` |
| Email | **Resend** | free tier sufficient (3k/mo + newsletter to 1k contacts) |
| Search | `@payloadcms/plugin-search` | courses, articles, events, projects |
| SEO | `@payloadcms/plugin-seo` | + hand-rolled schema.org JSON-LD |
| Redirects | `@payloadcms/plugin-redirects` | old Weebly URLs → new |
| Forms | `@payloadcms/plugin-form-builder` | admin-built registration forms |
| Newsletter | `payload-plugin-email-newsletter` | "food for thought" |

## 3. CILAS language

Use these exact terms in UI copy and field names — never translate to generic education-speak.

| Term | Meaning |
| --- | --- |
| pedagogy of discovery and attunement | core pedagogy (vs "consumption" / "mastery") |
| Discussion Based Learning (DBL) | main method; Pre- / Post-Discussion halves |
| fellow | teacher ("knows how to be a student") |
| CILASian | student / alumni / member |
| non-degree-seeking student | enrollee in individual courses |
| bridge programme | one-year flagship (2 semesters) |
| core curriculum | fall courses in the three fields |
| fields of study | Historical Consciousness, Philosophical & Poetic Inquiry, Ethnographic Study |
| thematic courses | spring, 12 weeks, open to visiting students |
| labs | 10–12 wk project-based ("playful production") |
| workshops | short skill/experiment offerings |
| course cycles | fall/winter/spring/summer seasonal offerings |
| Pigeon Tower | guiding metaphor (vs Ivory Tower); principles: diversity, intimacy, ignorance, play |
| co-creation of knowledge | knowledge made together, not transmitted |
| food for thought | tagline motif |
| conviviality | public talks, screenings, performances |
| narratives in lieu of grades | dialogic assessment |
| need-based deductions | tuition reductions |
| exhibition | end-of-year public showcase |
| bilingual | AR + EN throughout ("سيلاس") |

## 4. Course model

**Types (2 levels):**

| Type | Duration | Timing | Audience | Cost |
| --- | --- | --- | --- | --- |
| Bridge Programme | 1 yr (2 semesters) | ≥15 h/wk | enrolled CILASians | 18,000 LE |
| Core Course | semester | 10–12:30 / 5:30–8 | bridge | — |
| Thematic Course | 12 wks | 10–12:30 / 5:30–8 (Sat–Tue) | + visiting | — |
| Lab | 10–12 wks | 6–9 pm | public | 3–3.5k LE |
| Workshop | varies | varies | public | — |

Legacy mapping: Skill → Workshop, Capstone → skip, old 4 fields → 3 current (see Migration).

**Time model** — each course carries `day_of_week`, `start_time`, `session_duration` (minutes), `session_count`, `first_session_date`. End date = first + (count−1) × 7 days.

**Calendar** — one system-wide calendar aggregates courses (computed from schedule) + events (explicit dates). Home month/week view, filterable; each course detail page shows its own schedule block.

## 5. Roles & access

| Role | Login | Permissions |
| --- | --- | --- |
| super_admin | yes | full (content + users + roles + config) |
| admin | yes | all content; publish + feature articles |
| fellow | yes | write articles; CRUD own courses + profile |
| ciliasian | yes | write articles; read enrolled syllabus; profile |
| non_degree_seeking | yes | write articles; read enrolled course; profile |

Governance (advisors + trustees) — no login, content only.

**Articles:** any user writes → `draft` / `community`; only admin/super_admin → `public` + `featured`. Public reads `public` only; home shows `featured`.

## 6. Data model

| Collection | Purpose | Key fields |
| --- | --- | --- |
| `courses` | course / lab / workshop + syllabus | type, title/description/subtitle/epigraph/why_apply (localized), fields_of_study, cycle, schedule, tuition, fellows, registration_form, `sessions[]` |
| `programmes` | bridge programme | title, kind, academic_year, cycles[], tuition, weekly_hours, admission |
| `cycles` | season catalogue | label, season, year, mode, courses[] |
| `fields-of-study` | the 3 fields | title |
| `people` | auth users | name, photo, bio (single source of truth), role, field_of_study, cohort_year |
| `governance` | advisors + trustees | name, photo, bio, role, board_role, advises_on |
| `articles` | community writing | title, body, author, status, featured, tags, related_articles |
| `press` | marquee | organisation, logo, article_url |
| `events` | conviviality + exhibition | title, type, dates, recurring, fellows |
| `globals` | site settings | title, contact emails, social links, footer, support-us |

Plus `spaces`, `projects`, `media`, `newsletter`, `newsletter_archive`. Full schemas: [[CILAS-schema]].

**Syllabus** (`courses.sessions[]`): `order`, `week` (text — "Week 1", "2&3"), `theme`, `description`, `activity`, and `materials[]` = `type` (reading / watch / listen / sit-with / case-study / prompt / lecture) + `title` + `href` + `note`.

**Relationship:** `courses` → `cycle` → `programme`.

## 7. Pages & IA

| Old Weebly | New |
| --- | --- |
| about / at a glance | **Home** (sections — no About page). collaboration dropped (stale) |
| press | **Press** marquee |
| news-and-events | fold into **Articles** + **Events** (comments dropped) |
| People | **People** + **Governance** |
| space | **Space** |
| admissions | **Study** |
| mmm... | **Pigeon Tower** |

Home sections: hero, what-is-CILAS, how-we-learn, calendar, featured articles, press marquee, conviviality, newsletter CTA.

Pages: **Home**, **Study**, **People**, **Space**, **Pigeon Tower**, **Articles**, **Search**, **عربية** (`/ar/…`, RTL).

## 8. Migration

Fully automated; humans review only (QA gate), never type. Content exists verbatim on HTML + 171 PDFs.

1. **Scrape** — 220 pages → spine (cycles, courses, press, spaces, rosters).
2. **AI extract** — per course page + PDF → full `courses` doc (description, why_apply, sessions, materials, bios) verbatim.
3. **Import** — JSON → Payload, keyed by source URL (idempotent).
4. **QA** — admin spot-checks, fixes mis-parses, publishes.

Rules: verbatim only (never hallucinate); bio extracted once into `people`, referenced from courses.

## 9. UI

- **Timeline** — animated horizontal calendar archive (courses / cycles / bridge layers), color-coded, hover cards.
- **Calendar** — month/week grid, filterable, showing occurrence + duration per entry.
- **Icons** — per type: Pigeon Tower / compass / tree / flask / tool.

## 10. Roadmap & backlog

| Phase | What | Dep |
| --- | --- | --- |
| 0 Foundation | scaffold, wire Neon + R2 + Vercel, locales | — |
| 1 Data model | collections + plugins | 0 |
| 2 Migration | scrape + AI extract → import | 1 |
| 3 Frontend | Home, Study, People, Space, Pigeon Tower, Articles, calendar | 1 |
| 4 Polish | RTL, SEO JSON-LD, search UI, a11y, motion | 3 |

**Nice-to-have (non-committed):** iCal export, related courses, waitlist, OG images, analytics, Arabic search, versioning, email digest, dark mode, auto-slugs, materials graph.

## References

- https://www.ci-las.org/
- Payload docs: https://payloadcms.com/docs
- [[CILAS-schema]]
