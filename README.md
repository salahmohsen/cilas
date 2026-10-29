<div align="center">
  <img width="92" height="157" src="public/assets/images/logo.webp" alt="CILAS logo">
  <h1>CILAS<br/> Cairo Institute of Liberal Arts and Sciences</h1>
  <br>
</div>

## Motivation

During my one-year enrollment in the Bridge Programme at CILAS, I experienced a transformative learning environment that emphasized discussion-based learning, creative inquiry, self-reflection, and civic engagement. This was a stark contrast to the traditional academic approach I had previously encountered.

Inspired by this powerful educational model, I am now driven to contribute to CILAS and similar forward-thinking institutions through the development of a comprehensive Education Management System. This platform aims to empower administrators to operate the institute with greater efficiency while, more crucially, providing students with a robust digital environment to share ideas, collaborate, and meaningfully engage with our complex world.

CILAS brings the institute’s public website, content management, applications, and private learning community into one bilingual platform. The current application runs on Payload CMS and PostgreSQL; the earlier standalone Drizzle application is preserved on [`backup/legacy-drizzle`](https://github.com/salahmohsen/cilas/tree/backup/legacy-drizzle).

## Features

The features below describe the implementation on `main`. Email, search, Google sign-in, movie metadata, and Spaces availability depend on their configuration.

### Courses and programmes

- Create, edit, draft, review, publish, and archive courses with assigned fellows, cover images, teaching languages, and online, in-person, or hybrid delivery.
- Organize courses into term cycles and programmes, including Bridge cohorts, Women’s Studies, and residencies.
- Build course flows as structured sessions with descriptions, activities, readings, meeting dates, cancellations, and schedule overrides.
- Manage recurring schedules, places, registration windows, capacity, application questions, and pricing settings.
- Track course enrollments from application through acceptance, confirmation, completion, or withdrawal. Teaching fellows can record assessments with restricted access.
- Maintain programme memberships separately from course enrollments, including cohort and residential fellow relationships.
- Browse public study pages, programme and cohort archives, course details, and a calendar.

### People and accounts

- Separate public person profiles from login accounts, with biographies, photos, social links, teaching credits, and programme affiliations.
- Support super administrator, administrator, fellow, member, and non-degree-seeking student roles, with role-specific admin navigation and document ownership rules.
- Sign in with email and password, reset passwords, and optionally continue with Google.
- Let signed-in users manage their profiles; use deterministic avatar fallbacks when a photo is absent.

### Applications and forms

- Build application and contact forms in the CMS, including custom fields, confirmation emails, and redirects.
- Accept course and programme applications with private supporting files.
- Review, accept, or reject applications. Acceptance finds or creates the applicant’s account and person record, then creates the relevant enrollment or membership.
- Send acceptance emails and notify administrators of new applications when email delivery is configured.
- Export submissions as CSV or JSON, with administrator-only access to submissions and supporting files.
- Protect public submissions with a honeypot and optional Cloudflare Turnstile.

### Publishing and editorial work

- Manage articles, publications, press coverage, events, and newsletters alongside teaching content.
- Let eligible members and fellows propose writing, and fellows propose courses, through an editorial review workflow.
- Request changes, approve submissions, and handle removal requests from the admin review queue. Changes to published work remain drafts until approved.
- Control visibility separately from publication status: owner-only, signed-in community, or public where supported.
- Feature articles on the homepage and record authors, translation credits, tags, and related articles or publications.
- Edit rich text with columns, person profiles, movie cards, image galleries, related content, and mentions. The movie picker can retrieve metadata through TMDB when configured.
- Use draft versions, autosave, responsive live previews, and inline visual editing for supported content.
- Manage media uploads, image sizes, focal points, SEO metadata, and legacy URL redirects.

### Public events

- Publish talks, panels, book discussions, reading groups, screenings, performances, exhibitions, workshops, and other events.
- Set cover images, speakers and their roles, schedules, agendas, registration, pricing, physical venues, and online links.
- Relate events to a series, programme, or course, and browse upcoming and past events through public listings and detail pages.

### Newsletters and notifications

- Compose newsletters in the CMS, preview their email content, and send through Resend.
- Manage mailing lists backed by Resend segments, public newsletter signup, and subscriber CSV export.
- Receive in-app notifications for editorial decisions, applications, mentions, replies, announcements, and Space event changes.
- Keep daily, weekly, or off digest preferences. Scheduled digest delivery remains future work.

### Spaces

Spaces are private community areas inside the website, with access derived from existing teaching and membership records.

- **Community spaces:** shared areas with audiences for all members, fellows, or administrators.
- **Cohort spaces:** programme communities based on programme memberships.
- **Course spaces:** learning communities for enrolled participants and the course’s fellows.

Within eligible spaces, members and moderators can:

- Complete onboarding, accept privacy rules, introduce themselves, read pinned posts, check their profiles, and choose digest preferences. Course and cohort spaces with an introduction post require a member’s introduction before opening the rest of the feed.
- Create discussion posts, announcements, and course-session posts, with file attachments and member mentions.
- Comment, reply, react to posts and comments, and edit or remove their contributions according to permissions.
- Create Space events with dates, locations, covers, and RSVPs; notify attendees of changes.
- Run votes with single or multiple choices, optional anonymity, and closing times.
- Read feeds and individual post links, with post dialogs that retain feed context.
- Browse member rosters, space descriptions, pinned content, and unread activity.

Moderators can pin posts, lock discussions, remove content, and configure posting and event creation permissions. Space lifecycle rules support read-only past spaces and reopening. Administrators can switch Spaces off, enable selected trial spaces, or enable the system generally from Site settings.

Space files stay private and are served through authorization checks. Enrollment, membership, role, privacy consent, and introduction requirements also apply to private search.

### Search

- Search published public courses, articles, and people through bilingual Typesense indexes, with shared result filters and sorting.
- Optionally search private Space posts, comments, and attachment metadata through a server-mediated endpoint. Private results are checked against the requesting user’s current access before being returned.
- Keep private search credentials server-side and separate from the browser’s public search-only key.
- Maintain private indexes through an outbox, rebuild generations, and recovery tooling. PostgreSQL remains the source of truth.

### Language and interface

- English and Arabic routes and localized CMS content, including right-to-left Arabic layouts.
- Responsive public pages, member areas, and admin previews for desktop, tablet, and mobile.
- Light and dark themes, reusable interface components, and keyboard and screen-reader support across shared controls.
- Site settings for institutional content, navigation, email configuration, and Spaces introduction and privacy rules.

## Technology

- **Application:** Next.js 16, React 19, TypeScript, and Tailwind CSS 4.
- **CMS:** Payload CMS 3 with the PostgreSQL adapter and Lexical rich text.
- **Storage:** Cloudflare R2 for production media and private files; local S3-compatible storage for development.
- **Services:** Resend email, optional Google OAuth and Turnstile, Typesense search, and optional TMDB metadata.
- **Quality checks:** ESLint, Prettier, Vitest, and Playwright.

## Local development

Use Node.js 22, pnpm, and Docker for the local PostgreSQL service.

```sh
git clone https://github.com/salahmohsen/cilas.git
cd cilas
pnpm install --frozen-lockfile
cp .env.example .env
openssl rand -hex 32
```

Set `PAYLOAD_SECRET` to the generated value and configure a development database:

```dotenv
DATABASE_URL=postgresql://cilas:dev@localhost:5433/cilas_dev
NEXT_PUBLIC_SERVER_URL=http://localhost:3000
```

Start only the development database service from the root Compose file:

```sh
docker compose up -d db
```

Configure the required `R2_*` variables for a development bucket or follow the [local object storage guide](docs/local-object-storage.md) for the existing R2-to-RustFS workflow. Uploads have no local filesystem fallback. Keep `media/*` publicly readable while `spaces/*` and `applications/*` remain private.

The root Compose file also contains old template services; use the `db` service explicitly. Use a disposable local database for development and tests.

Schema changes use explicit migrations (`push: false`). Apply them before starting an initialized development installation:

```sh
pnpm db:migrate
pnpm dev
```

Historical migrations may require repair when starting from an empty database; the CI fixture bootstrap in the [deployment guide](docs/production-deployment.md) is a separate path for disposable smoke-test databases. The checked-in [seed and archive tooling](migration/README.md) documents imported content and review steps.

Open `http://localhost:3000` for the site and `http://localhost:3000/admin` for the CMS. On a new initialized database, create the first administrator through the admin setup screen.

### Optional integrations

Use [.env.example](.env.example) and [src/env.ts](src/env.ts) as the configuration references:

- **Email:** `RESEND_API_KEY` and `EMAIL_FROM_ADDRESS`. Without a Resend key, development emails are logged and newsletter signup and sending are disabled.
- **Google sign-in:** `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
- **Turnstile:** configure both `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` together.
- **Movie metadata:** server-only `TMDB_API_READ_TOKEN`; observe TMDB’s usage and attribution requirements.
- **Public search:** server `TYPESENSE_*` settings for indexing and `NEXT_PUBLIC_TYPESENSE_*` settings with a restricted search-only browser key.
- **Private search:** `PRIVATE_SPACES_SEARCH`, the key verification flag, and separate server-only private search/write keys. Complete the migration, key audit, rebuild, and maintenance setup in the [operations guide](docs/private-spaces-search-operations.md) before enabling it.

## Development commands

```sh
pnpm dev                  # Development server
pnpm build                # Production build
pnpm start                # Serve the production build
pnpm lint                 # ESLint
pnpm exec tsc --noEmit    # Type checking
pnpm test:int             # Vitest suite
pnpm test:e2e             # Playwright suite
pnpm test:production      # Production smoke tests with their fixture setup
pnpm generate:types       # Payload types after schema changes
pnpm generate:importmap   # Payload admin component import map
pnpm db:migrate:create    # Generate a migration for schema changes
pnpm db:migrate           # Apply migrations to the configured database
```

Database-backed tests require a dedicated local database and the appropriate fixtures. See the [private search verification guide](docs/private-spaces-search-verification.md) for the isolated search test environment. Installation also sets up the repository’s [commit checks](docs/commit-checks.md).

## Project documentation

- [Domain language](CONTEXT.md) and [architecture decisions](docs/adr/).
- [Archive migration and imports](migration/README.md).
- [Local object storage](docs/local-object-storage.md).
- [Private Spaces search operations](docs/private-spaces-search-operations.md) and [verification](docs/private-spaces-search-verification.md).
- [Production deployment and previews](docs/production-deployment.md).
- [Public Typesense upgrades](docs/public-typesense-upgrade.md).

## Continuing the original roadmap

Course enrollment, role-based permissions, reviewed member writing, course discussions, notifications, and responsive layouts now have implementations. Automatic completion certificates and scheduled Space email digests remain future work.

The introduction and motivation above come from the [legacy README](https://github.com/salahmohsen/cilas/blob/backup/legacy-drizzle/README.md); its original feature checklist has been updated to describe the current CMS and Spaces system.
