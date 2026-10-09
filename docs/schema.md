# Target schema

The Payload schema CILAS is moving to. It replaces the old `CILAS.md` / `CILAS-schema.md` plan. Terms are defined in [CONTEXT.md](../CONTEXT.md), and the reasoning behind the big choices is in [docs/adr](./adr).

The code in `src/collections` is what exists today. This file is what it should become. Delete each section once the code matches it.

Conventions:
- Text that people read is `localized` (en, ar).
- Arabic falls back to English and English falls back to Arabic, and the page says "available in X only" when it shows the fallback.
- Every imported document has a hidden `legacy_url` and an `import_status`.

## Shared shapes

**`schedule`** (courses, events). See ADR 0002.
- `start_date`
- `start_precision`: `day` | `week`
- `weeks`
- `slots[]` {`weekday`, `start_time`, `end_time`, `label`}, in Africa/Cairo wall-clock time
- `end_date`: computed by a hook
- `note` (localized): one-off exceptions, e.g. "hybrid for the first 6 weeks, then online"
- A single shared `expandSchedule()` produces every date shown anywhere. Only `day`-precision items appear on the calendar.

**`registration`** (cycles, courses, events, programmes)
- `method`: `form` (→ forms) | `external` (url) | `closed`
- `deadline`
- `application_requirements` (rich text)
- `archived_registration_url` (hidden)
- Whether registration is open is computed from the deadline. A course uses its own deadline if it has one, otherwise its cycle's.

**`pricing`**
- `min`, `max`
- `currency`: EGP
- `note`
- `need_based_deductions` (bool)
- `payment_plans[]` {`label`, `installments[]` {`amount`, `due_date`}}

**`credits[]`** (articles, publications)
- `role`: author | translator | editor | illustrator | photographer | other
- `label`
- `people[]` → people

## Time and place

**`spaces`**
- name, slug, `state` (current | former), `city`, `opened_year`, `closed_year`, description, images[]

**`cycles`** (ADR 0003)
- `season`: fall | winter | spring | summer
- `start_year`
- `space` → spaces (required)
- `title` and `slug` are built from season, year and space and normalised. Legacy trimesters map onto fall, winter and spring.
- `start_date`. `academic_year` is derived from it, with the year starting in September.
- `registration`
- `pricing[]` {`course_types[]`, `pricing`}
- Dropped: `mode` (use the course's `location`), `programme` group, `courses` group (courses point to their cycle).

## Programmes

**`programmes`**: drafts enabled. Unverified Bridge years (2020–21, 2023–24, 2024–25) are kept as drafts.
- `kind`: bridge | women_studies | residency
- `title`, `slug`, `tagline`, `cover`, `overview`, `highlights[]`
- `cycles[]` → cycles: the two semester cycles for a Bridge
- `components[]` {`label`, `description`, `cycle`, `course_types[]`}. The courses in each component are derived from its cycle and course types.
- `featured_courses[]`
- People come from memberships and are not stored on the programme.
- `testimonials[]`, `capacity`, `schedule_note`, `self_directed_study`, `weekly_hours`
- `registration`, `requirements`, `pricing`, `faqs[]`, `partners[]` → partners

## Teaching

**`courses`**
- `tier`
- `course_type`: CORE | THEMATIC | LAB | WORKSHOP | SHORT
- `cycle` (required)
- title, slug, subtitle, summary, epigraph, cover_image, description
- `location` hasMany: OFFLINE | ONLINE | HYBRID. This is the only place mode is stored.
- `teaching_languages[]`, `language_note`
- `schedule`
- `registration`, `pricing_override`
- `fellows[]` → people
- `facilitator_note`, `content_warning`, `syllabus_tentative`
- `session_unit`: `week` | `session` (default `session`). It controls the label shown: "Week 3" / "الأسبوع ٣" or "Session 3" / "الجلسة ٣". There is no per-session label; odd units use `session_title`.
- `sessions[]`
  - `order`, `session_title`, `description`
  - `meetings`: how many of the schedule's meetings this session takes, by default the number of slots per week
  - `dates[]` {`date`, `start_time`, `end_time`} (optional)
    - When filled, it replaces this session's computed dates: remove a row to cancel a meeting, change a date to move it, add one to make it up.
    - These dates stay fixed even if the schedule changes later.
    - In the admin, the computed dates are shown as placeholders.
  - `cancelled`: skips the whole session
  - `bibliography[]` (material: reading | watch | listen | prompt | other, with an optional `href`)
  - `activities[]` {`kind`: discussion | field_visit | exercise | screening | presentation | other, `description` (localized)}
- course-level `bibliography[]`
- Dropped: `tuition` group, `based_deductions_available`, `fields_of_study`, the per-session date/time group.
- Course flows are not attached to the course. Their content is imported into it (ADR 0004).
- No `why_apply`, `learning_outcomes`, `weekly_workload`, `mode_note` or `location_note`. Workload and outcomes stay in the description in the fellow's own words; only about 16% of course flows have an outcomes section. Space comes from the cycle, and exceptions to the mode go in `schedule.note`.

**`enrollments`**
- `person` → people
- `course` → courses
- `status`
- `slot`
- `assessment`
- `source`

## Partners

People, users, governance and memberships match the code (ADR 0001).

**`partners`**
- name, logo, url, kind (funder | co_host | outlet | other)

## Publishing

**`articles`**: drafts enabled.
- `tier`: admins only
- `requested_tier`: set by the author
- `review`
  - draft → submitted → changes_requested → approved | rejected
  - `review_note`
  - Approval sets `tier`, `_status` and `published_date` together.
  - Authors and admins are emailed when the status changes.
- Authors: users with member, fellow or non_degree_seeking roles, and admins. An author can't publish their own article.
- `credits[]`
- `translation` group (original language, original article/url, translator credit)

**`publications`** (renamed from `article-collections`)
- `kind`, `title`, `slug`, `subtitle`, `intro`, `cover_image`
- `year_from`, `year_to`
- `credits[]`
- `foreword` → articles
- `articles[]`
- `produced_by[]` → courses
- `funders[]` → partners
- `license`, `print_edition_url`

**`press`**
- `kind`
- `title` (not localized)
- `language`
- `outlet` → partners
- `authors`: people or free text
- `published_date`, `date_precision`
- `links[]` {`language`, `url`, `archived_url`}
- `excerpt`

**`events`**
- `tier`, title, description, `event_type` (extended list)
- `schedule`
- `space` → spaces, or `external_venue`, plus `online_url`
- `agenda[]`
- `speakers[]` {`person`, `role`}
- `partners[]` {`partner`, `role`}
- `series`
- `programme` / `course` links
- `registration`, `pricing`

**`newsletters`** (ADR 0005)
- An archive of sent issues: title, date, body.
- Subscribers are kept in Resend Audiences, not in Payload.
- A transactional email adapter in the Payload config sends review notifications.

## Plugins
All pinned to the same version as the other `@payloadcms` packages.
- `plugin-redirects`: the seeder creates one redirect per legacy URL, and admins can edit them without a deploy.
- `plugin-seo`: on courses, cycles, programmes, publications, articles, events and press. Localized, and filled in automatically from title, summary and cover.
- `plugin-search`: postponed until the frontend has a search page.

## Removed
- `fields-of-study` and every reference to it.
- Stored course-flow PDFs, which are never kept in media or R2.

## Archive import (seed)
- **Sources:**
  - The Weebly "Archive Site" ZIP (202 pages and their uploads, snapshot of 23 Apr 2025) is the primary source.
  - The Wayback Machine fills in what the ZIP doesn't have: 86 pages including every 2025–26 cycle, 29 course-flow PDFs and 77 assets.
  - An image linked as `published/X.ext` is found in the ZIP as `X_orig.ext`.
  - Raw files live in `migration/raw/`, which is in `.gitignore` and `.dockerignore`. The ZIP is at `migration/raw/weebly-zip-2025-04-23/`, and the Wayback cache goes to `migration/raw/wayback/`. Only the manifest and the normalised JSON are committed.
- **Stages:**
  1. ingest → `migration/manifest.json`
  2. extract to per-page JSON
  3. normalise to `seed/data/archive/*.json`, with people deduplicated through `aliases.json`
  4. seed
- **Seeding:**
  - Updates or creates each document by `legacy_url`.
  - Rich text goes through `convertHTMLToLexical`.
  - Only images that some page links to are uploaded to media.
  - Each legacy URL gets a redirect.
  - Imported documents land as drafts marked needs review.
- The development-only `resetContent()` wipe must never run against reviewed content.

## Open
- **SiteSettings:** `social_links` platform `twitter` → `x`, to match people.
