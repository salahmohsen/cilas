import { randomBytes } from 'node:crypto'

import type { CollectionConfig } from 'payload'

import { isAdmin } from '@/access'
import { FILE_KINDS } from '@/lib/form-files'

/**
 * Files sent with a form (a CV, a writing sample): personal data, so admins
 * only. They are written by the form endpoint (src/forms/submit-with-files.ts),
 * never through the API, and served through Payload, which checks access; the
 * names are random so no one can guess one in the storage bucket.
 */
export const SubmissionFiles: CollectionConfig = {
  slug: 'submission-files',
  labels: { singular: 'Submission file', plural: 'Submission files' },
  access: { read: isAdmin, create: () => false, update: () => false, delete: isAdmin },
  admin: { hidden: true },
  upload: {
    mimeTypes: Object.values(FILE_KINDS).flatMap((k) => [...k.mime]),
    filesRequiredOnCreate: true,
  },
  hooks: {
    beforeOperation: [
      ({ operation, req }) => {
        if (operation !== 'create' || !req.file) return
        const safe = req.file.name.replace(/[^\w.-]+/g, '-').slice(-80)
        req.file.name = `${randomBytes(16).toString('hex')}-${safe}`
      },
    ],
  },
  fields: [
    {
      name: 'field',
      type: 'text',
      admin: { readOnly: true, description: 'The question it answers.' },
    },
  ],
}
