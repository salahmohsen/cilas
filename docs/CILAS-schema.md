---
tags:
  - cilas-project
---

# CILAS — Payload Schemas

Full TypeScript field definitions. Referenced from [[CILAS]].

## `courses`

```ts
import type { CollectionConfig } from 'payload'

export const Courses: CollectionConfig = {
  slug: 'courses',
  fields: [
    {
      name: 'course_type',
      type: 'select',
      required: true,
      options: [
        { label: 'Core Course', value: 'CORE' },
        { label: 'Thematic Course', value: 'THEMATIC' },
        { label: 'Lab', value: 'LAB' },
        { label: 'Workshop', value: 'WORKSHOP' },
      ],
    },
    { name: 'title', type: 'text', required: true, localized: true },
    { name: 'description', type: 'richText', localized: true },
    { name: 'subtitle', type: 'text', localized: true },
    { name: 'epigraph', type: 'text', localized: true }, // "food for thought" quote
    { name: 'learning_outcomes', type: 'array', localized: true, fields: [{ name: 'outcome', type: 'textarea' }] },
    { name: 'bibliography', type: 'array', localized: true, fields: [{ name: 'citation', type: 'text' }] },
    { name: 'why_apply', type: 'array', localized: true, fields: [{ name: 'point', type: 'text' }] },
    { name: 'weekly_workload', type: 'richText', localized: true }, // "what to expect"
    { name: 'mode_note', type: 'text' }, // "in person or on Zoom"
    {
      name: 'fields_of_study',
      type: 'relationship',
      relationTo: 'fields-of-study',
      hasMany: true,
      admin: { condition: (data) => ['CORE', 'THEMATIC'].includes(data.course_type) },
    },
    { name: 'cycle', type: 'relationship', relationTo: 'cycles' },
    {
      name: 'location',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'Offline', value: 'OFFLINE' },
        { label: 'Online', value: 'ONLINE' },
        { label: 'Hybrid', value: 'HYBRID' },
      ],
    },
    {
      name: 'schedule',
      type: 'group',
      fields: [
        {
          name: 'day_of_week',
          type: 'select',
          required: true,
          options: ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(d => ({ label: d, value: d })),
        },
        { name: 'start_time', type: 'text', required: true }, // "17:30"
        { name: 'session_duration', type: 'number', required: true }, // minutes, e.g. 150 for 2.5 hours
        { name: 'session_count', type: 'number', required: true },
        { name: 'first_session_date', type: 'date', required: true },
        // computed: end_date = first_session_date + (session_count - 1) × 7 days
      ],
    },
    {
      name: 'tuition',
      type: 'group',
      fields: [
        { name: 'amount', type: 'number' },
        { name: 'need_based', type: 'checkbox', label: 'Need-based deductions available' },
      ],
    },
    { name: 'fellows', type: 'relationship', relationTo: 'people', hasMany: true },
    {
      name: 'registration_form',
      type: 'relationship',
      relationTo: 'forms', // from @payloadcms/plugin-form-builder
      admin: { description: 'Admin-built form, open for registration' },
    },
    {
      name: 'sessions',
      type: 'array',
      label: 'Syllabus (session-by-session)',
      fields: [
        { name: 'order', type: 'number' }, // sort key
        { name: 'week', type: 'text' }, // "Week 1", "2&3", "9–10 (optional)" — text, not integer
        { name: 'theme', type: 'text', localized: true },
        { name: 'description', type: 'richText', localized: true },
        { name: 'activity', type: 'text', localized: true }, // "Field visit", "Guest lecture", "Screening"
        {
          name: 'materials',
          type: 'array',
          fields: [
            {
              name: 'type',
              type: 'select',
              required: true,
              options: [
                { label: 'Reading', value: 'reading' },
                { label: 'Watch', value: 'watch' },
                { label: 'Listen', value: 'listen' },
                { label: 'Sit with', value: 'sit_with' },
                { label: 'Case study', value: 'case_study' },
                { label: 'Prompt', value: 'prompt' },
                { label: 'Lecture', value: 'lecture' },
                { label: 'Link', value: 'link' },
              ],
            },
            { name: 'title', type: 'text', localized: true },
            { name: 'href', type: 'text' }, // youtube / vimeo / article url
            { name: 'note', type: 'text', localized: true }, // author, year, pages; primary vs secondary reading
          ],
        },
      ],
    },
  ],
}
```

## `programmes`

```ts
import type { CollectionConfig } from 'payload'

export const Programmes: CollectionConfig = {
  slug: 'programmes',
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'kind', type: 'select', options: [{ label: 'Bridge Programme', value: 'BRIDGE' }] },
    { name: 'academic_year', type: 'text' }, // e.g. "2025–2026"
    { name: 'cycles', type: 'relationship', relationTo: 'cycles', hasMany: true }, // ordered: fall → spring
    {
      name: 'tuition',
      type: 'group',
      fields: [
        { name: 'amount', type: 'number' }, // 18,000
        { name: 'installments', type: 'number' }, // 3
        { name: 'need_based_deductions', type: 'checkbox' },
      ],
    },
    { name: 'weekly_hours', type: 'number' }, // ≥15
    { name: 'admission_requirements', type: 'richText', localized: true },
    { name: 'self_directed_study', type: 'checkbox' }, // between the two semesters
    { name: 'registration_form', type: 'relationship', relationTo: 'forms' }, // open for registration
  ],
}
```

**Relationship:** `courses` → `cycle` → `programme`. The bridge programme is a named sequence of cycles (fall = core, spring = thematic + lab); a cycle also carries standalone public courses. Course membership is transitive through its cycle.

## `cycles`

```ts
import type { CollectionConfig } from 'payload'

export const Cycles: CollectionConfig = {
  slug: 'cycles',
  fields: [
    { name: 'label', type: 'text', required: true }, // "Spring Semester 2026"
    { name: 'season', type: 'select', options: ['fall', 'winter', 'spring', 'summer'].map(v => ({ label: v, value: v })) },
    { name: 'year', type: 'number' },
    {
      name: 'mode',
      type: 'select',
      options: [
        { label: 'Offline', value: 'OFFLINE' },
        { label: 'Online', value: 'ONLINE' },
        { label: 'Hybrid', value: 'HYBRID' },
      ],
    },
    { name: 'courses', type: 'relationship', relationTo: 'courses', hasMany: true },
  ],
}
```

## `fields-of-study`

```ts
import type { CollectionConfig } from 'payload'

export const FieldsOfStudy: CollectionConfig = {
  slug: 'fields-of-study',
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    // Historical Consciousness, Philosophical and Poetic Inquiry, Ethnographic Study
  ],
}
```

## `people` (auth users — the community)

```ts
import type { CollectionConfig } from 'payload'

export const People: CollectionConfig = {
  slug: 'people',
  auth: true,
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'photo', type: 'upload', relationTo: 'media' },
    { name: 'bio', type: 'richText', localized: true }, // SINGLE SOURCE OF TRUTH — referenced everywhere, never copied
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'cilasian',
      options: [
        { label: 'Super Admin', value: 'super_admin' },
        { label: 'Admin', value: 'admin' },
        { label: 'Fellow', value: 'fellow' },
        { label: 'CILASian', value: 'cilasian' },
        { label: 'Non-Degree-Seeking Student', value: 'non_degree_seeking' },
      ],
    },
    { name: 'field_of_study', type: 'relationship', relationTo: 'fields-of-study', admin: { condition: (d) => d.role === 'fellow' } },
    { name: 'cohort_year', type: 'text', admin: { condition: (d) => d.role === 'cilasian' } }, // "CILASians 2016–2017"
    { name: 'courses', type: 'relationship', relationTo: 'courses', hasMany: true, admin: { condition: (d) => d.role === 'fellow' } },
  ],
}
```

**Permission matrix:**

| Role | Login | Permissions |
| --- | --- | --- |
| `super_admin` | yes | full: all content CRUD + users + roles + config |
| `admin` | yes | all content CRUD; publish articles to `public`; set `featured`. No user/role/config management. |
| `fellow` | yes | write articles (`community`); CRUD own courses + own profile |
| `ciliasian` | yes | write articles (`community`); read enrolled syllabus; edit own profile |
| `non_degree_seeking` | yes | write articles (`community`); read enrolled course; edit own profile |

**Per-collection access:** every collection mirrors this matrix. Fellows get `update`/`delete` on courses where their `people` id is in `courses.fellows`. `governance` + `press` have no auth access.

## `governance` (content-only — no login)

```ts
import type { CollectionConfig } from 'payload'

export const Governance: CollectionConfig = {
  slug: 'governance',
  auth: false,
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'photo', type: 'upload', relationTo: 'media' },
    { name: 'bio', type: 'richText', localized: true },
    {
      name: 'role',
      type: 'select',
      required: true,
      options: [
        { label: 'Advisor', value: 'advisor' },
        { label: 'Trustee', value: 'trustee' },
      ],
    },
    { name: 'board_role', type: 'text', admin: { condition: (d) => d.role === 'trustee' } }, // "Chairman", "Secretary", "Treasurer"
    { name: 'advises_on', type: 'text', admin: { condition: (d) => d.role === 'advisor' } }, // "curriculum design and university partnerships"
  ],
}
```

## `articles` (community writing — authored by users)

```ts
import type { CollectionConfig } from 'payload'

export const Articles: CollectionConfig = {
  slug: 'articles',
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    { name: 'body', type: 'richText', localized: true },
    { name: 'author', type: 'relationship', relationTo: 'people', required: true },
    { name: 'cover_image', type: 'upload', relationTo: 'media' },
    { name: 'published_date', type: 'date' },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },          // author only
        { label: 'Community', value: 'community' },  // all logged-in users
        { label: 'Public', value: 'public' },        // world — admin/super_admin only
      ],
    },
    { name: 'featured', type: 'checkbox', label: 'Feature on home page' }, // admin/super_admin only
    { name: 'tags', type: 'array', fields: [{ name: 'tag', type: 'text' }] },
    {
      name: 'related_articles',
      type: 'relationship',
      relationTo: 'articles',
      hasMany: true,
      admin: { description: 'Manual override: editor-curated related articles. If empty, automated recommendations by tag overlap are used.' },
    },
  ],
  access: {
    read: ({ req }) => {
      if (!req.user) return { status: { equals: 'public' } }
      return { or: [
        { status: { in: ['community', 'public'] } },
        { author: { equals: req.user.id } }, // own drafts
      ]}
    },
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => req.user?.role === 'admin' || req.user?.role === 'super_admin'
      ? true
      : { author: { equals: req.user.id } },
    delete: ({ req }) => ['admin', 'super_admin'].includes(req.user?.role),
  },
}
```

Publishing rule: any user writes → `draft`/`community`. Only `admin`/`super_admin` promote to `public` and set `featured` — enforced via a `beforeChange` hook.

## `press` (marquee source — external coverage)

```ts
import type { CollectionConfig } from 'payload'

export const Press: CollectionConfig = {
  slug: 'press',
  access: { create: adminOnly, update: adminOnly, delete: adminOnly, read: () => true },
  fields: [
    { name: 'organisation', type: 'text', required: true }, // "Mada Masr", "OpenDemocracy", "Egyptian Streets"
    { name: 'logo', type: 'upload', relationTo: 'media', required: true },
    { name: 'article_url', type: 'text', required: true }, // external link to the piece mentioning CILAS
    { name: 'article_title', type: 'text' },
    { name: 'published_date', type: 'date' },
  ],
}
```

## `events` (conviviality + exhibition)

```ts
import type { CollectionConfig } from 'payload'

export const Events: CollectionConfig = {
  slug: 'events',
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    { name: 'description', type: 'richText', localized: true },
    {
      name: 'event_type',
      type: 'select',
      options: [
        { label: 'Talk', value: 'talk' },
        { label: 'Screening', value: 'screening' },
        { label: 'Performance', value: 'performance' },
        { label: 'Reading Group', value: 'reading_group' },
        { label: 'Exhibition', value: 'exhibition' },
        { label: 'Workshop', value: 'workshop' },
      ],
    },
    { name: 'date', type: 'date' },
    { name: 'end_date', type: 'date' }, // for multi-day events
    { name: 'start_time', type: 'text' },
    { name: 'recurring', type: 'checkbox' }, // reading groups recur weekly
    { name: 'frequency', type: 'select', options: ['weekly', 'biweekly', 'monthly'].map(v => ({ label: v, value: v })), admin: { condition: (d) => d.recurring } },
    { name: 'recurrence_until', type: 'date', admin: { condition: (d) => d.recurring } },
    { name: 'location', type: 'select', options: [
      { label: 'Offline', value: 'OFFLINE' },
      { label: 'Online', value: 'ONLINE' },
    ]},
    { name: 'fellows', type: 'relationship', relationTo: 'people', hasMany: true },
  ],
}
```

## `globals` (site settings)

```ts
import type { GlobalConfig } from 'payload'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  fields: [
    { name: 'site_title', type: 'text' },
    { name: 'contact_emails', type: 'group', fields: [
      { name: 'admissions', type: 'text' },
      { name: 'info', type: 'text' },
    ]},
    { name: 'social_links', type: 'array', fields: [
      { name: 'platform', type: 'select', options: ['facebook', 'twitter', 'youtube', 'instagram'].map(v => ({ label: v, value: v })) },
      { name: 'url', type: 'text' },
    ]},
    { name: 'footer_text', type: 'richText', localized: true },
    { name: 'support_us', type: 'richText', localized: true }, // IBAN bank-transfer donation details
  ],
}
```

## Remaining collections

| Collection           | Purpose                                                                                              |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| `spaces`             | al-Ghuria, Darb el-Labbana, al-Manshiya — name, status (current/former), description, images         |
| `projects`           | The Pigeon Tower section: on-pigeon-towers, translation-as-education, other projects                 |
| `media`              | Images + PDFs (syllabi, outlines, essay collection) — with `alt`, `caption`, `focal_point` for crops |
| `newsletter`         | Subscribers                                                                                          |
| `newsletter_archive` | 18 old "Pigeon Tower" newsletter issues — PDFs in `media` or a small archive collection              |
