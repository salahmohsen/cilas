import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { People } from './collections/People'
import { Memberships } from './collections/Memberships'
import { Media } from './collections/Media'
import { Courses } from './collections/Courses'
import { Enrollments } from './collections/Enrollments'
import { Programmes } from './collections/Programmes'
import { Cycles } from './collections/Cycles'
import { Governance } from './collections/Governance'
import { Articles } from './collections/Articles'
import { Press } from './collections/Press'
import { Events } from './collections/Events'
import { MailingLists } from './collections/MailingLists'
import { Notifications } from './collections/Notifications'
import { SubmissionFiles } from './collections/SubmissionFiles'
import { Newsletters } from './collections/Newsletters'
import { Places } from './collections/Places'
import { Spaces } from './collections/Spaces'
import { SpacePosts } from './collections/SpacePosts'
import { SpaceComments } from './collections/SpaceComments'
import { SpaceFiles } from './collections/SpaceFiles'
import { SpaceReactions } from './collections/SpaceReactions'
import { SpaceRsvps } from './collections/SpaceRsvps'
import { SpaceVotes } from './collections/SpaceVotes'
import { SpaceConsents } from './collections/SpaceConsents'
import { SpaceVisits } from './collections/SpaceVisits'
import { SpacePreferences } from './collections/SpacePreferences'
import { Publications } from './collections/Publications'
import { SiteSettings } from './globals/SiteSettings'
import { EmailSettings } from './globals/EmailSettings'
import { SpaceIntroduction } from './globals/SpaceIntroduction'
import { SpaceRules } from './globals/SpaceRules'
import { resendAdapter } from '@payloadcms/email-resend'
import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { importExportPlugin } from '@payloadcms/plugin-import-export'
import { ensureNameEmail, formFields } from './forms/form-fields'
import { notifyNewApplication } from './forms/notify-application'
import { submitWithFiles } from './forms/submit-with-files'
import { applicationEndpoints, applicationFields, checkTarget } from './forms/applications'
import { requireTurnstile } from './forms/spam-check'
import { redirectsPlugin } from '@payloadcms/plugin-redirects'
import { seoPlugin } from '@payloadcms/plugin-seo'
import type {
  GenerateDescription,
  GenerateImage,
  GenerateTitle,
  GenerateURL,
} from '@payloadcms/plugin-seo/types'
import { s3Storage } from '@payloadcms/storage-s3'
import { payloadTheme } from 'payload-theme'

import { anyone, isAdmin } from './access'
import { env } from './env'
import { defaultEditorFeatures } from './lexical/default-features'
import { pathOf } from './lib/paths'
import { SEO_COLLECTIONS, seoDefaults, type SeoCollection } from './lib/seo'
import { googleAuth } from './plugins/google-auth'
import { llmsTxt } from './plugins/llms'
import { visualEditor } from 'payload-inline-visual-editor'
import { roleNav } from './plugins/role-nav'
import { typesenseSearch } from './plugins/typesense'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const storage = s3Storage({
  collections: {
    media: {
      disableLocalStorage: true, // Recommended for production
      prefix: 'media', // Optional prefix for uploaded files
      // No local fallback: disableLocalStorage means nothing else to serve from.
      generateFileURL: ({ filename, prefix }) =>
        `${env.R2_PUBLIC_URL.replace(/\/+$/, '')}/${prefix}/${encodeURIComponent(filename)}`,
    },
    // Applicants' files: no public URL; Payload serves them to admins only.
    'submission-files': { disableLocalStorage: true, prefix: 'applications' },
    'space-files': { disableLocalStorage: true, prefix: 'spaces' },
  },
  bucket: env.R2_BUCKET,
  config: {
    endpoint: env.R2_ENDPOINT,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
    region: env.R2_REGION,
    forcePathStyle: true, // Required for R2
  },
})

// The Generate buttons and the page metadata share seoDefaults().
const seoFor = (collectionSlug: string | undefined, doc: Record<string, unknown>) =>
  seoDefaults((collectionSlug ?? 'courses') as SeoCollection, doc ?? {})

const generateTitle: GenerateTitle = ({ collectionConfig, doc }) =>
  seoFor(collectionConfig?.slug, doc).title ?? ''
const generateDescription: GenerateDescription = ({ collectionConfig, doc }) =>
  seoFor(collectionConfig?.slug, doc).description ?? ''
const generateImage: GenerateImage = ({ collectionConfig, doc }) =>
  seoFor(collectionConfig?.slug, doc).image ?? ''
const generateURL: GenerateURL = ({ collectionConfig, doc, locale }) =>
  `${env.NEXT_PUBLIC_SERVER_URL}${pathOf(collectionConfig?.slug ?? '', doc ?? {}, locale ?? 'en') ?? ''}`

export default buildConfig({
  // System email only. Newsletter subscribers live in Resend Audiences (ADR 0005).
  email: env.RESEND_API_KEY
    ? resendAdapter({
        apiKey: env.RESEND_API_KEY,
        defaultFromAddress: env.EMAIL_FROM_ADDRESS,
        defaultFromName: 'CILAS',
      })
    : undefined,
  admin: {
    user: Users.slug,
    components: {
      // Admin → Subscribers: the newsletter list from Resend, with CSV export.
      // Reached from the Newsletters list (src/components/admin/subscribers-link.tsx).
      views: {
        subscribers: {
          Component: '/components/admin/subscribers-view#SubscribersView',
          path: '/subscribers',
        },
        // Admin → Reviews: what waits for an admin (src/lib/review-queue.ts).
        reviews: {
          Component: '/components/admin/review-queue#ReviewQueueView',
          path: '/reviews',
        },
      },
      // The dashboard opens with what waits for review, for admins.
      beforeDashboard: ['/components/admin/review-queue#ReviewQueueWidget'],
      // The notifications bell in the top bar (src/collections/Notifications.ts).
      actions: ['/components/admin/notification-bell#NotificationBell'],
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
    // Opens the frontend route for the document being edited, in an iframe,
    // and refreshes it as autosave lands. Each collection supplies its own path
    // via `admin.livePreview.url`.
    livePreview: {
      url: '/',
      collections: ['courses', 'articles', 'programmes', 'newsletters'],
      breakpoints: [
        { name: 'mobile', label: 'Mobile', width: 390, height: 844 },
        { name: 'tablet', label: 'Tablet', width: 768, height: 1024 },
        { name: 'desktop', label: 'Desktop', width: 1440, height: 900 },
      ],
    },
  },
  collections: [
    Users,
    People,
    Memberships,
    Media,
    Courses,
    Enrollments,
    Programmes,
    Cycles,
    Governance,
    Articles,
    Publications,
    Press,
    Events,
    Newsletters,
    MailingLists,
    SubmissionFiles,
    Notifications,
    Places,
    Spaces,
    SpacePosts,
    SpaceComments,
    SpaceFiles,
    SpaceReactions,
    SpaceConsents,
    SpaceVisits,
    SpacePreferences,
    SpaceVotes,
    SpaceRsvps,
  ],
  globals: [SiteSettings, EmailSettings, SpaceIntroduction, SpaceRules],
  localization: {
    locales: [
      { label: 'English', code: 'en' },
      { label: 'Arabic', code: 'ar', rtl: true },
    ],
    defaultLocale: 'en',
    fallback: true,
  },
  editor: lexicalEditor({ features: defaultEditorFeatures }),
  secret: env.PAYLOAD_SECRET,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: env.DATABASE_URL,
      // Longer-lived connections for long imports. No connect timeout: the
      // build pre-renders hundreds of pages at once, and a query waiting for
      // a free connection must wait, not fail.
      idleTimeoutMillis: 60_000,
      keepAlive: true,
    },
    // Explicit migrations rather than dev-mode schema auto-push. Auto-push asks
    // to DROP tables on stdin, which silently destroys data when it runs
    // non-interactively (CI, vitest, any `getPayload` in a script) — and it
    // leaves no record of what changed.
    push: false,
    migrationDir: path.resolve(dirname, 'migrations'),
  }),
  sharp,
  plugins: [
    formBuilderPlugin({
      fields: formFields,
      // The forms themselves, with their emails and redirects, are admin work.
      formOverrides: {
        access: { read: anyone, create: isAdmin, update: isAdmin, delete: isAdmin },
        // Any form asks name and email first; no admin deletes or renames them.
        hooks: { beforeChange: [ensureNameEmail] },
      },
      // Applications are read by admins only; anyone may send one.
      formSubmissionOverrides: {
        access: { read: isAdmin, update: isAdmin, delete: isAdmin },
        admin: { defaultColumns: ['form', 'target', 'status', 'createdAt'] },
        // Applications: admins accept or reject them from the submission.
        fields: ({ defaultFields }) => [...defaultFields, ...applicationFields],
        // Applications (accept, reject) and the submissions that carry files.
        endpoints: [
          ...applicationEndpoints,
          { path: '/with-files', method: 'post', handler: submitWithFiles },
        ],
        hooks: {
          beforeChange: [requireTurnstile(env.TURNSTILE_SECRET_KEY), checkTarget],
          afterChange: [notifyNewApplication],
        },
      },
    }),
    // Admins export form submissions (applications, contact messages) as CSV
    // or JSON. Downloads only: nothing is saved, and no import.
    importExportPlugin({
      collections: [
        {
          slug: 'form-submissions',
          export: { disableJobsQueue: true, disableSave: true },
          import: false,
        },
      ],
      overrideExportCollection: ({ collection }) => ({
        ...collection,
        access: { ...collection.access, read: isAdmin, create: isAdmin, delete: isAdmin },
      }),
      overrideImportCollection: ({ collection }) => ({
        ...collection,
        access: { ...collection.access, read: isAdmin, create: isAdmin, delete: isAdmin },
      }),
    }),
    seoPlugin({
      collections: [...SEO_COLLECTIONS],
      uploadsCollection: 'media',
      generateTitle,
      generateDescription,
      generateImage,
      generateURL,
    }),
    redirectsPlugin({
      collections: [
        'courses',
        'cycles',
        'programmes',
        'publications',
        'articles',
        'events',
        'press',
        'people',
      ],
      redirectTypes: ['301', '302'],
      redirectTypeFieldOverride: { defaultValue: '301' },
      overrides: {
        // The default lets any signed-in account rewrite where old links go.
        access: { read: anyone, create: isAdmin, update: isAdmin, delete: isAdmin },
        admin: { group: 'Site' },
      },
    }),
    storage,
    payloadTheme({ accent: '#000' }),
    // Site search: bilingual Typesense collections of the public courses,
    // articles and people. Off without TYPESENSE_API_KEY (builds, tests).
    typesenseSearch(),
    googleAuth(),
    // /llms.txt and /llms-full.txt for language models (src/plugins/llms.ts).
    llmsTxt(),
    // Click-to-edit in live preview, and a full-screen editor at
    // /admin/visual-editor/:collection/:id. The pages mark their fields
    // (src/lib/editable.ts); sessions can be added and reordered on the page.
    visualEditor({
      collections: {
        courses: { blockOps: { add: true, duplicate: true, remove: true, move: true } },
        articles: true,
        // The email preview (/api/email-preview) loads the site SDK itself.
        newsletters: { blockOps: { add: true, duplicate: true, remove: true, move: true } },
      },
    }),
    // What each role sees in the admin nav. Last, so it covers plugin collections.
    roleNav(),
  ],
})
