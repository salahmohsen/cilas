import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Courses } from './collections/Courses'
import { Programmes } from './collections/Programmes'
import { Cycles } from './collections/Cycles'
import { FieldsOfStudy } from './collections/FieldsOfStudy'
import { Governance } from './collections/Governance'
import { Articles } from './collections/Articles'
import { Press } from './collections/Press'
import { Events } from './collections/Events'
import { Spaces } from './collections/Spaces'
import { ArticleCollections } from './collections/Article-collections'
import { SiteSettings } from './globals/SiteSettings'
import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [
    Users,
    Media,
    Courses,
    Programmes,
    Cycles,
    FieldsOfStudy,
    Governance,
    Articles,
    ArticleCollections,
    Press,
    Events,
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
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
  }),
  sharp,
  plugins: [formBuilderPlugin({})],
})
