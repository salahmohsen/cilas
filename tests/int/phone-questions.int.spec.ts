// @vitest-environment node
import { afterAll, beforeAll, expect, it } from 'vitest'
import { getPayload, createLocalReq, type Payload } from 'payload'
import config from '@/payload.config'
import type { User } from '@/payload-types'
import { MCP_TOOLS } from '@/plugins/mcp'
import { createTracker, uniq, uniqEmail } from './fixtures'
let payload: Payload
let admin: User
const { track, cleanup } = createTracker()
beforeAll(async () => {
  payload = await getPayload({ config })
  admin = track(
    'users',
    await payload.create({
      collection: 'users',
      data: { email: uniqEmail('phone-admin'), password: crypto.randomUUID(), roles: ['admin'] },
    }),
  )
})
afterAll(async () => {
  await cleanup(payload)
  await payload.destroy()
})
it('MCP saves a phone question and real Markdown description in both locales', async () => {
  const title = uniq('Phone MCP')
  const req = await createLocalReq({ user: { ...admin, collection: 'users' } as never }, payload)
  const result = await MCP_TOOLS.find((t) => t.name === 'create_form_and_link')!.handler(
    {
      title: { en: title },
      questions: [
        {
          type: 'phone',
          label: { en: 'Phone', ar: 'الهاتف' },
          description: { en: '**Call** [us](https://example.org)\n\n- First', ar: '**اتصل**' },
        },
      ],
    },
    req,
    {},
  )
  expect(result).not.toHaveProperty('isError', true)
  const form = (
    await payload.find({ collection: 'forms', where: { title: { equals: title } }, locale: 'en' })
  ).docs[0]
  track('forms', form)
  const question = form.fields?.find((q) => q.blockType === 'phone')
  expect(question).toMatchObject({ blockType: 'phone', name: 'phone', defaultCountry: 'EG' })
  expect(JSON.stringify(question)).toContain('"type":"link"')
  expect(JSON.stringify(question)).toContain('"type":"list"')
  expect(JSON.stringify(question)).toContain('"format":1')
  const ar = await payload.findByID({ collection: 'forms', id: form.id, locale: 'ar' })
  expect(JSON.stringify(ar.fields)).toContain('اتصل')
  await expect(
    payload.create({
      collection: 'form-submissions',
      data: { form: form.id, submissionData: [{ field: 'phone', value: '+20100' }] },
    }),
  ).rejects.toThrow('Enter a valid phone number with its country code.')
})
it('MCP writes phone course questions with restricted rich descriptions', async () => {
  const title = uniq('Phone course MCP')
  const req = await createLocalReq({ user: { ...admin, collection: 'users' } as never }, payload)
  const result = await MCP_TOOLS.find((t) => t.name === 'create_course_draft')!.handler(
    {
      title: { en: title },
      course_type: 'THEMATIC',
      applicant_questions: [
        {
          blockType: 'phone',
          label: { en: 'Contact phone' },
          defaultCountry: 'GB',
          description: { en: '**Contact** [us](https://example.org)\n\n1. First' },
        },
      ],
    },
    req,
    {},
  )
  expect(result).not.toHaveProperty('isError', true)
  const course = (
    await payload.find({ collection: 'courses', where: { title: { equals: title } }, draft: true })
  ).docs[0]
  track('courses', course)
  expect(course.applicant_questions?.[0]).toMatchObject({
    blockType: 'phone',
    name: 'contact_phone',
    defaultCountry: 'GB',
  })
  expect(JSON.stringify(course.applicant_questions)).toContain('"type":"list"')
  expect(JSON.stringify(course.applicant_questions)).toContain('"type":"link"')
})
