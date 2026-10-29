// @vitest-environment node
import { createLocalReq, getPayload, type Payload } from 'payload'
import type { PostgresAdapter } from '@payloadcms/db-postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import config from '@/payload.config'
import { up, down } from '@/migrations/20261029_081500_programme_editorial'
import { programmeEditorial, type ProgrammeEditorial } from '@/migrations/lib/programme-editorial'
import type { Programme } from '@/payload-types'

const body: NonNullable<Programme['overview']> = {
  root: {
    type: 'root',
    version: 1,
    format: '',
    indent: 0,
    direction: null,
    children: [
      {
        type: 'paragraph',
        version: 1,
        format: '',
        indent: 0,
        direction: null,
        children: [
          {
            type: 'text',
            version: 1,
            text: 'Original body',
            format: 0,
            detail: 0,
            mode: 'normal',
            style: '',
          },
        ],
      },
    ],
  },
}
const normalize = (value: unknown) =>
  JSON.parse(JSON.stringify(value, (_, v) => (v === undefined ? null : v)))

describe('programme editorial data migration', () => {
  let payload: Payload
  beforeAll(async () => {
    payload = await getPayload({ config })
  })
  afterAll(async () => {
    await payload.destroy()
  })

  it('migrates EN/AR documents and draft history, retries safely, and restores original rows on rollback', async () => {
    const transactionID = await payload.db.beginTransaction()
    if (!transactionID) throw new Error('Migration test requires a database transaction')
    const sessions = payload.db.sessions as PostgresAdapter['sessions']
    const db = sessions[transactionID!].db
    const req = await createLocalReq({}, payload)
    req.transactionID = transactionID
    try {
      const doc = await payload.create({
        collection: 'programmes',
        locale: 'en',
        req,
        data: {
          title: 'Editorial fixture',
          slug: `editorial-${crypto.randomUUID()}`,
          kind: 'residency',
          _status: 'published',
          overview: body,
          highlights: [{ text: 'First highlight' }],
          testimonials: [
            { quote: 'First testimonial', attribution: 'CILASian' },
            { quote: 'Second testimonial' },
          ],
        },
      })
      await payload.update({
        collection: 'programmes',
        id: doc.id,
        locale: 'ar',
        draft: true,
        req,
        data: {
          title: 'برنامج',
          overview: body,
          highlights: [{ id: doc.highlights![0].id, text: 'نقطة' }],
          testimonials: [
            { id: doc.testimonials![0].id, quote: 'شهادة', attribution: 'طالب' },
            { id: doc.testimonials![1].id, quote: 'شهادة ثانية' },
          ],
        },
      })
      const read = () =>
        payload.db.findOne<ProgrammeEditorial & { id: number }>({
          collection: 'programmes',
          where: { id: { equals: doc.id } },
          locale: 'all',
          req,
        })
      const history = () =>
        payload.db.findVersions<ProgrammeEditorial & { id: number }>({
          collection: 'programmes',
          where: { parent: { equals: doc.id } },
          locale: 'all',
          pagination: false,
          req,
        })
      const before = await read()
      const versions = await history()
      await up({ db, payload, req })
      const migrated = await read()
      expect(normalize(migrated)).toEqual(
        normalize({
          ...before,
          overview: programmeEditorial(before!),
          highlights: [],
          testimonials: [],
        }),
      )
      const afterVersions = await history()
      expect(normalize(afterVersions.docs)).toEqual(
        normalize(
          versions.docs.map((v) => ({
            ...v,
            version: {
              ...v.version,
              overview: programmeEditorial(v.version),
              highlights: [],
              testimonials: [],
            },
          })),
        ),
      )
      const content = JSON.stringify(afterVersions.docs)
      for (const text of [
        'First highlight',
        'First testimonial',
        'Second testimonial',
        'نقطة',
        'شهادة',
      ]) {
        expect(content).toContain(text)
      }
      await up({ db, payload, req })
      expect(normalize(await read())).toEqual(normalize(migrated))
      await down({ db, payload, req })
      expect(normalize(await read())).toEqual(normalize(before))
      expect(normalize((await history()).docs)).toEqual(normalize(versions.docs))
      await up({ db, payload, req })
      expect(normalize(await read())).toEqual(normalize(migrated))
      await payload.db.updateOne({
        collection: 'programmes',
        id: doc.id,
        locale: 'all',
        req,
        data: { overview: { en: body } },
      })
      await expect(down({ db, payload, req })).rejects.toThrow(/newer editorial changes/)
    } finally {
      await payload.db.rollbackTransaction(transactionID!)
    }
  })
})
