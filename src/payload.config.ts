import { PREVIEW_COLLECTIONS } from '@/lib/preview-url'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { BUCKET_PREFIXES } from '@/lib/storage-usage'
import { emailEditorFeatures } from '@/lexical/email-features'
import { formEmailRichText } from '@/forms/email-rich-text'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { PushSubscriptions } from './collections/PushSubscriptions'
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
import { RegistrationDefaults } from './globals/RegistrationDefaults'
import { SiteSettings } from './globals/SiteSettings'
import { EmailSettings } from './globals/EmailSettings'
import { SpaceIntroduction } from './globals/SpaceIntroduction'
import { SpaceRules } from './globals/SpaceRules'
import { resendAdapter } from '@payloadcms/email-resend'
import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { previewUrl } from '@/lib/preview-url'
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

import { adminOnlyField, anyone, isAdmin } from './access'
import { env } from './env'
import { defaultEditorFeatures } from './lexical/default-features'
import { pathOf } from './lib/paths'
import { SEO_COLLECTIONS, seoDefaults, type SeoCollection } from './lib/seo'
import { adminDashboard } from './plugins/admin-dashboard'
import { googleAuth } from './plugins/google-auth'
import { llmsTxt } from './plugins/llms'
import { visualEditor } from 'payload-inline-visual-editor'
import { roleNav } from './plugins/role-nav'
import { adminMcp } from './plugins/mcp'
import { AI_ACCESS_VIEW } from './plugins/mcp/paths'
import { typesenseSearch } from './plugins/typesense'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const storage = s3Storage({
  collections: {
    media: {
      disableLocalStorage: true, // Recommended for production
      prefix: BUCKET_PREFIXES.media, // Optional prefix for uploaded files
      // No local fallback: disableLocalStorage means nothing else to serve from.
      generateFileURL: ({ filename, prefix }) =>
        `${env.R2_PUBLIC_URL.replace(/\/+$/, '')}/${prefix}/${encodeURIComponent(filename)}`,
    },
    // Applicants' files: no public URL; Payload serves them to admins only.
    'submission-files': { disableLocalStorage: true, prefix: BUCKET_PREFIXES.submissions },
    'space-files': { disableLocalStorage: true, prefix: BUCKET_PREFIXES.spaces },
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
    // The linked person's photo in payload-theme's user block (the theme's own
    // `avatar: { field }` reads only the account, which has no photo).
    avatar: { Component: '/components/admin/admin-avatar#AdminAvatar' },
    // The browser tab and link previews: CILAS, not Payload. Open Graph images
    // are off (the admin is private); the defaults would say "Payload App".
    meta: {
      titleSuffix: ' | CILAS admin',
      defaultOGImageType: 'off',
      description: 'The CILAS admin.',
      icons: [
        { rel: 'icon', type: 'image/svg+xml', url: '/assets/icons/favicon.svg' },
        { rel: 'icon', type: 'image/png', url: '/assets/images/favicon.png' },
        { rel: 'apple-touch-icon', url: '/assets/icons/apple-touch-icon.png' },
      ],
      openGraph: {
        siteName: 'CILAS admin',
        title: 'CILAS admin',
        description: 'The CILAS admin.',
        images: [{ url: '/assets/images/og-default.jpg', width: 1200, height: 630 }],
      },
    },
    components: {
      // The CILAS mark in place of Payload's logo and icon. payload-theme draws
      // its own sidebar and login logo from `payloadTheme({ logo, icon })`.
      graphics: {
        Logo: '/components/admin/brand/admin-logo#AdminLogo',
        Icon: '/components/admin/brand/admin-logo#AdminIcon',
      },
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
        // Admin → AI access guide: reached from the AI access list.
        aiAccess: { Component: AI_ACCESS_VIEW, path: '/ai-access' },
      },
      // The top bar: links to Reviews and Subscribers for admins, then the
      // notifications bell (src/collections/Notifications.ts). payload-theme
      // replaces the sidebar (Nav) and the dashboard view, so `beforeNavLinks`
      // and `beforeDashboard` never render; `actions` does. The dashboard is
      // src/plugins/admin-dashboard.ts.
      actions: [
        '/components/admin/work-links#WorkLinks',
        '/components/admin/notification-bell#NotificationBell',
      ],
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
    // Opens the frontend route for the document being edited, in an iframe,
    // and refreshes it as autosave lands. Each collection supplies its own path
    // via `admin.livePreview.url`.
    livePreview: {
      url: '/',
      collections: [...PREVIEW_COLLECTIONS, 'newsletters', 'events'],
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
    PushSubscriptions,
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
  globals: [RegistrationDefaults, SiteSettings, EmailSettings, SpaceIntroduction, SpaceRules],
  localization: {
    locales: [
      { label: 'English', code: 'en' },
      { label: 'Arabic', code: 'ar', rtl: true },
    ],
    defaultLocale: 'en',
    fallback: true,
  },
  // The few admin strings that still name Payload.
  i18n: {
    translations: {
      en: {
        general: { payloadSettings: 'Admin settings' },
        payloadTheme: { shortcutSaveDocument: 'Save the document' },
      },
    },
  },
  editor: lexicalEditor({ features: defaultEditorFeatures }),
  secret: env.PAYLOAD_SECRET,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
    schema: [
      // The AI access keys are an auth collection, so Payload would type
      // `req.user` as `User | PayloadMcpApiKey`. No request is ever signed in
      // as a key: Payload leaves that collection out of its API key login, and
      // the MCP plugin signs in the key's owner, a `users` account.
      ({ jsonSchema }) => ({
        ...jsonSchema,
        properties: { ...jsonSchema.properties, user: { $ref: '#/definitions/users' } },
      }),
    ],
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
      beforeEmail: formEmailRichText,
      fields: formFields,
      formOverrides: {
        admin: {
          defaultColumns: ['title', 'template', 'updatedAt'],
          livePreview: { url: previewUrl('forms') },
          preview: (data, { locale }) => previewUrl('forms')({ data, locale: { code: locale } }),
        },
        fields: ({ defaultFields }) => [
          {
            name: 'template',
            type: 'checkbox',
            label: 'Template',
            defaultValue: false,
            admin: {
              position: 'sidebar',
              description:
                'A template is copied when a new cycle, Bridge year or course with its own registration needs a form. Editing it later does not change copies.',
            },
          },
          ...defaultFields.map((field) =>
            'name' in field && field.name === 'emails' && 'fields' in field
              ? {
                  ...field,
                  access: { ...field.access, read: adminOnlyField },
                  fields: field.fields.map((child) =>
                    child.type === 'richText'
                      ? { ...child, editor: lexicalEditor({ features: emailEditorFeatures }) }
                      : child,
                  ),
                }
              : field,
          ),
        ],
        access: { read: anyone, create: isAdmin, update: isAdmin, delete: isAdmin },
        hooks: { beforeChange: [ensureNameEmail] },
      },
      formSubmissionOverrides: {
        access: { read: isAdmin, update: isAdmin, delete: isAdmin },
        admin: { defaultColumns: ['form', 'target', 'status', 'createdAt'] },
        fields: ({ defaultFields }) => [...defaultFields, ...applicationFields],
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
    payloadTheme({
      accent: '#000',
      // One SVG per colour scheme: the theme draws these as <img>, where
      // `currentColor` cannot reach. Generated by scripts/build-admin-brand.ts.
      logo: {
        light: '/assets/admin/cilas-mark-light.svg',
        dark: '/assets/admin/cilas-mark-dark.svg',
      },
      logoHeight: 40,
      icon: {
        light: '/assets/admin/cilas-mark-light.svg',
        dark: '/assets/admin/cilas-mark-dark.svg',
      },
      login: {
        heading: 'CILAS admin',
        tagline: 'Sign in to manage courses, people and the site.',
      },
    }),
    // The admin home: statistics for admins, the theme's cards for everyone
    // else. After payloadTheme(), which sets the same slot.
    adminDashboard(),
    // Site search: bilingual Typesense collections of the public courses,
    // articles and people. Off without TYPESENSE_API_KEY (builds, tests).
    typesenseSearch(),
    googleAuth(),
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
    // AI assistants make drafts through /api/mcp (src/plugins/mcp). Admins only.
    ...adminMcp(),
    // What each role sees in the admin nav. Last, so it covers plugin collections.
    roleNav(),
  ],
})
