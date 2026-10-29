import { postgresAdapter } from '@payloadcms/db-postgres'
import { getPayload } from 'payload'

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

try {
  await payload.create({
    collection: 'forms',
    data: {
      title: 'Contact',
      fields: [{ blockType: 'textarea', name: 'message', label: 'Message', required: true }],
      confirmationMessage: {
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
      },
    },
  })
} finally {
  await payload.destroy()
}

process.exit(0)
