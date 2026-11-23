import { postgresAdapter } from '@payloadcms/db-postgres'
import { getPayload } from 'payload'

import { CONTACT_FORM_TITLE } from '../src/lib/contact'
import { up as createPrivateSearchTables } from '../src/migrations/20261028_120000_private_search'
import type { Form } from '../src/payload-types'
import { articleSlug, courseSlug } from './smoke.fixture'

const database = 'postgres://cilas:dev@localhost:55440/cilas_ci'
if (process.env.DATABASE_URL !== database) {
  throw new Error('Smoke fixtures require the disposable cilas_ci database on localhost:55440')
}

const { default: config } = await import('../src/payload.config')
const resolved = await config
resolved.db = {
  ...postgresAdapter({ pool: { connectionString: database }, push: true }),
  allowIDOnCreate: false,
  name: 'postgres',
}
const payload = await getPayload({ config: resolved })

const confirmationMessage: Form['confirmationMessage'] = {
  root: {
    type: 'root',
    format: '',
    indent: 0,
    version: 1,
    direction: 'ltr',
    children: [
      {
        type: 'paragraph',
        version: 1,
        children: [{ type: 'text', version: 1, text: 'Thank you.' }],
      },
    ],
  },
}

try {
  await createPrivateSearchTables({ db: payload.db.drizzle } as Parameters<
    typeof createPrivateSearchTables
  >[0])
  await payload.create({
    collection: 'forms',
    data: {
      title: CONTACT_FORM_TITLE,
      fields: [{ blockType: 'textarea', name: 'message', label: 'Message', required: true }],
      confirmationMessage,
    },
  })
  const place = await payload.create({
    collection: 'places',
    data: { name: 'Smoke campus', slug: 'smoke-campus', city: 'Cairo' },
  })
  const cycle = await payload.create({
    collection: 'cycles',
    data: { season: 'spring', start_year: 2031, place: place.id, start_date: '2031-03-04' },
  })
  await payload.create({
    collection: 'courses',
    data: {
      title: 'Smoke course',
      slug: courseSlug,
      course_type: 'THEMATIC',
      cycle: cycle.id,
      registration: { mode: 'closed' },
      tier: 'public',
      _status: 'published',
    },
  })
  const author = await payload.create({
    collection: 'people',
    data: { name: 'Smoke author', slug: 'smoke-author' },
  })
  await payload.create({
    collection: 'articles',
    data: {
      title: 'Smoke article',
      slug: articleSlug,
      authors: [author.id],
      review: { status: 'approved' },
      tier: 'public',
      _status: 'published',
    },
  })
  const application = await payload.create({
    collection: 'forms',
    data: {
      title: 'Smoke Bridge application',
      confirmationMessage,
      fields: [{ blockType: 'textarea', name: 'motivation', label: 'Why apply?', required: true }],
    },
  })
  await payload.create({
    collection: 'programmes',
    data: {
      title: 'Smoke Bridge year',
      slug: 'bridge-programme-2030-2031',
      kind: 'bridge',
      registration: { method: 'form', form: application.id },
      _status: 'published',
    },
  })
} finally {
  await payload.destroy()
}

process.exit(0)
