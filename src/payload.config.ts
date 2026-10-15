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
import { Newsletters } from './collections/Newsletters'
import { Spaces } from './collections/Spaces'
import { Publications } from './collections/Publications'
import { SiteSettings } from './globals/SiteSettings'
import { resendAdapter } from '@payloadcms/email-resend'
import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { formFields } from './forms/form-fields'
import { redirectsPlugin } from '@payloadcms/plugin-redirects'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { typesenseSearch } from '@rubixstudios/payload-typesense'
import type {
  GenerateDescription,
  GenerateImage,
  GenerateTitle,
  GenerateURL,
} from '@payloadcms/plugin-seo/types'
import { s3Storage } from '@payloadcms/storage-s3'
import { payloadTheme } from 'payload-theme'

import { anyone, hasRole, isAdmin } from './access'
import { env } from './env'
import { pathOf } from './lib/paths'
import { TYPESENSE_SEARCH_COLLECTIONS } from './lib/search-config'
import { SEO_COLLECTIONS, seoDefaults, type SeoCollection } from './lib/seo'
import { typesensePanelIndex } from './plugins/typesense-index'

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
  },
  bucket: env.R2_BUCKET,
  config: {
    endpoint: env.R2_ENDPOINT,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
    region: 'auto', // Required for R2
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
    importMap: {
      baseDir: path.resolve(dirname),
    },
    // Opens the frontend route for the document being edited, in an iframe,
    // and refreshes it as autosave lands. Each collection supplies its own path
    // via `admin.livePreview.url`.
    livePreview: {
      url: '/',
      collections: ['courses', 'articles', 'programmes'],
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
    Spaces,
  ],
  globals: [SiteSettings],
  localization: {
    locales: [
      { label: 'English', code: 'en' },
      { label: 'Arabic', code: 'ar', rtl: true },
    ],
    defaultLocale: 'en',
    fallback: true,
  },
  editor: lexicalEditor(),
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
      // Applications are read by admins only; anyone may send one.
      formSubmissionOverrides: {
        access: { read: isAdmin, update: isAdmin, delete: isAdmin },
      },
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
        admin: {
          group: 'Site',
          hidden: ({ user }) => !hasRole(user, 'admin', 'super_admin'),
        },
      },
    }),
    storage,
    payloadTheme({ accent: '#000' }),
    typesenseSearch({
      // Skipped entirely until TYPESENSE_API_KEY exists, so builds and tests
      // run fine without a Typesense server reachable.
      disabled: !env.TYPESENSE_API_KEY,
      typesense: {
        apiKey: env.TYPESENSE_API_KEY ?? '',
        nodes: [
          {
            host: env.TYPESENSE_HOST,
            port: env.TYPESENSE_PORT,
            protocol: env.TYPESENSE_PROTOCOL,
          },
        ],
      },
      // Rubix backgrounds the secondary collections the panel does not
      // read (programmes, publications, events, governance) — the panel's
      // three live in the panel indexer below, where both languages and
      // the owner field are handled together.
      collections: Object.fromEntries(
        Object.entries(TYPESENSE_SEARCH_COLLECTIONS)
          .filter(([slug]) => !['courses', 'articles', 'people'].includes(slug))
          .map(([slug, config]) => [
            slug,
            {
              enabled: true,
              searchFields: [...config.searchFields],
              displayName: config.displayName,
            },
          ]),
      ),
    }),
    // The search panel's own collections: per-language mirrors with the
    // `owner` field resolved from the related People documents.
    typesensePanelIndex(),
  ],
})
