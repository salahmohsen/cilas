// @vitest-environment node
import { getPayload, createLocalReq, initTransaction, killTransaction, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import config from '@/payload.config'
import type { RegistrationDefault } from '@/payload-types'
import { relId } from '@/lib/relation'
import { REGISTRATION_DEFAULTS } from '@/forms/templates'
import { createTracker, uniq } from './fixtures'
import { seedRegistrationDefaults } from '../../seed/collections/registration-defaults.seed'

const { track, cleanup } = createTracker()
let payload: Payload
let registrationDefaults: Partial<RegistrationDefault> = {}
let shared: RegistrationDefault
let template: number
let bridgeTemplate: number
let workshopTemplate: number
let existing: number
let place: number
let sequence = 0
const message = (text: string) => ({
  root: {
    type: 'root',
    version: 1,
    direction: 'ltr' as const,
    format: '' as const,
    indent: 0,
    children: [{ type: 'paragraph', version: 1, children: [{ type: 'text', version: 1, text }] }],
  },
})
const defaults = (id: number | null) => {
  registrationDefaults = {
    cycle_template: id,
    bridge_template: id === template ? bridgeTemplate : id,
    workshop_template: id === template ? workshopTemplate : id,
  }
}
const create = async (
  kind: 'cycles' | 'programmes' | 'courses',
  form?: number,
  method: 'form' | 'closed' = 'form',
) => {
  const registration = { method, form }
  const title = uniq(`Template entity ${++sequence}`)
  if (kind === 'cycles')
    return track(
      kind,
      await payload.create({
        collection: kind,
        context: { [REGISTRATION_DEFAULTS]: registrationDefaults },
        data: { season: 'fall', start_year: 2040 + sequence, place, registration },
      }),
    )
  if (kind === 'programmes')
    return track(
      kind,
      await payload.create({
        collection: kind,
        context: { [REGISTRATION_DEFAULTS]: registrationDefaults },
        draft: true,
        data: { title, slug: title, kind: 'bridge', registration },
      }),
    )
  return track(
    kind,
    await payload.create({
      collection: kind,
      context: { [REGISTRATION_DEFAULTS]: registrationDefaults },
      draft: true,
      data: {
        title,
        slug: title,
        course_type: 'CORE',
        registration:
          method === 'closed'
            ? { mode: 'closed' }
            : { ...registration, method: 'form', mode: 'own' },
      },
    }),
  )
}

describe('registration templates', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
    shared = await payload.findGlobal({ slug: 'registration-defaults', depth: 0 })
    place = track(
      'places',
      await payload.create({
        collection: 'places',
        data: {
          name: uniq('Template place'),
          city: uniq('Template city'),
          slug: uniq('template-place'),
        },
      }),
    ).id
    template = track(
      'forms',
      await payload.create({
        collection: 'forms',
        data: {
          title: uniq('Template'),
          template: true,
          confirmationType: 'message',
          confirmationMessage: message('Received'),
          submitButtonLabel: 'Apply now',
          fields: [{ blockType: 'textarea', name: 'reason', label: 'Your reason', required: true }],
          emails: [
            {
              emailTo: 'admin@cilas.test',
              subject: 'New application',
              message: message('English email'),
            },
          ],
        },
      }),
    ).id
    const en = await payload.findByID({ collection: 'forms', id: template, depth: 0 })
    await payload.update({
      collection: 'forms',
      id: template,
      locale: 'ar',
      data: {
        submitButtonLabel: 'قدّم',
        confirmationMessage: message('وصل الطلب'),
        fields: en.fields?.map((field) =>
          'name' in field && field.name === 'reason' ? { ...field, label: 'سبب التقديم' } : field,
        ),
        emails: en.emails?.map((email) => ({
          ...email,
          subject: 'طلب جديد',
          message: message('رسالة'),
        })),
      },
    })
    bridgeTemplate = track(
      'forms',
      await payload.duplicate({
        collection: 'forms',
        id: template,
        data: { title: uniq('Bridge template'), submitButtonLabel: 'Bridge apply' },
      }),
    ).id
    workshopTemplate = track(
      'forms',
      await payload.duplicate({
        collection: 'forms',
        id: template,
        data: { title: uniq('Workshop template'), submitButtonLabel: 'Workshop apply' },
      }),
    ).id
    existing = track(
      'forms',
      await payload.create({
        collection: 'forms',
        data: { title: uniq('Existing'), confirmationMessage: message('Thanks') },
      }),
    ).id
  })
  afterAll(async () => {
    await cleanup(payload)
    await payload.destroy()
  })

  for (const kind of ['cycles', 'programmes', 'courses'] as const) {
    it(`${kind}: copies once, preserving locales and keeping later template edits separate`, async () => {
      defaults(template)
      const entity = await create(kind)
      const id = relId(entity.registration?.form)!
      track('forms', id)
      expect(id).not.toBe(template)
      const copy = await payload.findByID({ collection: 'forms', id, depth: 0 })
      expect(copy.title).toBe(`${entity.title} application`)
      expect(copy.template).toBe(false)
      expect(copy.fields?.map((field) => ('name' in field ? field.name : ''))).toEqual([
        'name',
        'email',
        'reason',
      ])
      expect(copy.emails?.[0].emailTo).toBe('admin@cilas.test')
      const expectedLabel =
        kind === 'cycles' ? 'Apply now' : kind === 'programmes' ? 'Bridge apply' : 'Workshop apply'
      expect(copy.submitButtonLabel).toBe(expectedLabel)
      const arabic = await payload.findByID({
        collection: 'forms',
        id,
        depth: 0,
        locale: 'ar',
        fallbackLocale: false,
      })
      expect(arabic.submitButtonLabel).toBe('قدّم')
      expect(arabic.fields?.[2]).toMatchObject({ label: 'سبب التقديم' })
      expect(arabic.confirmationMessage).toEqual(message('وصل الطلب'))
      expect(arabic.emails?.[0].subject).toBe('طلب جديد')
      const again = await payload.update({
        collection: kind,
        context: { [REGISTRATION_DEFAULTS]: registrationDefaults },
        id: entity.id,
        data: {},
      })
      expect(relId(again.registration?.form)).toBe(id)
      expect(
        (await payload.find({ collection: 'forms', where: { title: { equals: copy.title } } }))
          .totalDocs,
      ).toBe(1)
      const sourceId =
        kind === 'cycles' ? template : kind === 'programmes' ? bridgeTemplate : workshopTemplate
      await payload.update({
        collection: 'forms',
        id: sourceId,
        data: { submitButtonLabel: 'Changed' },
      })
      expect((await payload.findByID({ collection: 'forms', id })).submitButtonLabel).toBe(
        expectedLabel,
      )
      await payload.update({
        collection: 'forms',
        id: sourceId,
        data: { submitButtonLabel: expectedLabel },
      })
    })
    it(`${kind}: keeps a selected form and leaves an empty default alone`, async () => {
      defaults(template)
      const before = await payload.count({
        collection: 'forms',
        where: { title: { contains: uniq('') } },
      })
      expect(relId((await create(kind, existing)).registration?.form)).toBe(existing)
      expect(
        (await payload.count({ collection: 'forms', where: { title: { contains: uniq('') } } }))
          .totalDocs,
      ).toBe(before.totalDocs)
      defaults(null)
      if (kind === 'cycles') await expect(create(kind)).rejects.toThrow(/form/i)
      else expect((await create(kind)).registration?.form).toBeFalsy()
      expect(
        (await payload.count({ collection: 'forms', where: { title: { contains: uniq('') } } }))
          .totalDocs,
      ).toBe(before.totalDocs)
    })
    it(`${kind}: does not copy for closed registration`, async () => {
      defaults(template)
      const before = await payload.count({
        collection: 'forms',
        where: { title: { contains: uniq('') } },
      })
      expect((await create(kind, undefined, 'closed')).registration?.form).toBeFalsy()
      expect(
        (await payload.count({ collection: 'forms', where: { title: { contains: uniq('') } } }))
          .totalDocs,
      ).toBe(before.totalDocs)
    })
    it(`${kind}: refuses a template as its registration form, including drafts`, async () => {
      defaults(null)
      await expect(create(kind, template)).rejects.toMatchObject({
        data: {
          errors: [
            {
              path: 'registration.form',
              message: expect.stringMatching(/template cannot be used/i),
            },
          ],
        },
      })
    })
  }

  it('copies when a course changes to own form registration, and merges partial updates', async () => {
    defaults(template)
    const course = await create('courses', undefined, 'closed')
    const updated = await payload.update({
      collection: 'courses',
      context: { [REGISTRATION_DEFAULTS]: registrationDefaults },
      id: course.id,
      data: { registration: { mode: 'own', method: 'form' } },
    })
    const id = relId(updated.registration?.form)!
    track('forms', id)
    expect(id).toBeTruthy()
    expect(id).not.toBe(template)
    const again = await payload.update({
      collection: 'courses',
      context: { [REGISTRATION_DEFAULTS]: registrationDefaults },
      id: course.id,
      data: { registration: { deadline: '2099-01-01' } },
    })
    expect(relId(again.registration?.form)).toBe(id)
  })

  it('does not copy for a non-Bridge programme', async () => {
    defaults(template)
    const programme = track(
      'programmes',
      await payload.create({
        collection: 'programmes',
        context: { [REGISTRATION_DEFAULTS]: registrationDefaults },
        draft: true,
        data: {
          title: uniq('Residency'),
          slug: uniq('residency'),
          kind: 'residency',
          registration: { method: 'form' },
        },
      }),
    )
    expect(programme.registration?.form).toBeFalsy()
  })

  it('copies when an admin switches a saved cycle or Bridge year to an empty site form', async () => {
    const admin = track(
      'users',
      await payload.create({
        collection: 'users',
        data: {
          email: `${uniq('template-admin')}@cilas.test`,
          password: crypto.randomUUID(),
          roles: ['admin'],
        } as never,
      }),
    )
    const asAdmin = { user: { ...admin, collection: 'users' } as never, overrideAccess: false }
    defaults(null)
    const bridge = await create('programmes')
    const cycle = await create('cycles', undefined, 'closed')
    await expect(
      payload.update({
        collection: 'cycles',
        context: { [REGISTRATION_DEFAULTS]: registrationDefaults },
        id: cycle.id,
        data: { registration: { method: 'form' } },
        ...asAdmin,
      }),
    ).rejects.toMatchObject({
      data: {
        errors: [
          {
            path: 'registration.form',
            message: 'Choose a form, or set a cycle template in Registration defaults.',
          },
        ],
      },
    })

    defaults(template)
    const switched = await payload.update({
      collection: 'cycles',
      context: { [REGISTRATION_DEFAULTS]: registrationDefaults },
      id: cycle.id,
      data: { registration: { method: 'form', form: null } },
      ...asAdmin,
    })
    const copy = relId(switched.registration?.form)!
    track('forms', copy)
    expect(copy).not.toBe(template)
    const bridgeCopy = relId(
      (
        await payload.update({
          collection: 'programmes',
          context: { [REGISTRATION_DEFAULTS]: registrationDefaults },
          id: bridge.id,
          draft: true,
          data: {},
          ...asAdmin,
        })
      ).registration?.form,
    )!
    track('forms', bridgeCopy)
    expect(bridgeCopy).not.toBe(bridgeTemplate)
  })

  it('rolls back the copied form when the parent cannot be published', async () => {
    defaults(template)
    const before = await payload.count({
      collection: 'forms',
      where: { title: { contains: uniq('') } },
    })
    await expect(
      payload.create({
        collection: 'courses',
        context: { [REGISTRATION_DEFAULTS]: registrationDefaults },
        data: {
          title: uniq('Invalid publication'),
          slug: uniq('invalid-publication'),
          tier: 'public',
          session_unit: 'session',
          course_type: 'CORE',
          _status: 'published',
          registration: { mode: 'own', method: 'form' },
        },
      }),
    ).rejects.toThrow(/cycle/i)
    expect(
      (await payload.count({ collection: 'forms', where: { title: { contains: uniq('') } } }))
        .totalDocs,
    ).toBe(before.totalDocs)
  })

  it('refuses templates on event registration too', async () => {
    await expect(
      payload.create({
        collection: 'events',
        draft: true,
        data: {
          title: uniq('Event'),
          slug: uniq('event'),
          event_type: 'talk',
          registration: { method: 'form', form: template },
        },
      }),
    ).rejects.toMatchObject({
      data: {
        errors: [
          { path: 'registration.form', message: expect.stringMatching(/template cannot be used/i) },
        ],
      },
    })
  })

  it('rejects non-template defaults and denies public access', async () => {
    await expect(
      payload.updateGlobal({ slug: 'registration-defaults', data: { cycle_template: existing } }),
    ).rejects.toThrow()
    await expect(
      payload.findGlobal({ slug: 'registration-defaults', overrideAccess: false }),
    ).rejects.toThrow()
    await expect(
      payload.updateGlobal({
        slug: 'registration-defaults',
        overrideAccess: false,
        data: { cycle_template: null },
      }),
    ).rejects.toThrow()
  })

  it('hides templates from anonymous reads while keeping live forms public', async () => {
    const result = await payload.find({
      collection: 'forms',
      overrideAccess: false,
      where: { id: { in: [template, existing] } },
    })
    expect(result.docs.map((f) => f.id)).toEqual([existing])
  })

  it.each([false, true])('refuses template submissions with target: %s', async (withTarget) => {
    await expect(
      payload.create({
        collection: 'form-submissions',
        data: {
          form: template,
          ...(withTarget ? { target: { relationTo: 'courses' as const, value: 1 } } : {}),
          submissionData: [
            { field: 'name', value: 'Applicant' },
            { field: 'email', value: 'a@cilas.test' },
          ],
        },
      }),
    ).rejects.toThrow('A template cannot receive submissions.')
  })

  it('seeds three usable templates and reuses them on a second seed', async () => {
    const req = await createLocalReq({}, payload)
    await initTransaction(req)
    try {
      await seedRegistrationDefaults(payload, req)
      const seeded = await payload.findGlobal({ slug: 'registration-defaults', depth: 0, req })
      for (const key of ['cycle_template', 'bridge_template', 'workshop_template'] as const) {
        const id = relId(seeded[key])!
        const form = await payload.findByID({ collection: 'forms', id, req })
        expect(form.template).toBe(true)
        expect(form.fields?.length).toBeGreaterThan(2)
      }
      await seedRegistrationDefaults(payload, req)
      const again = await payload.findGlobal({ slug: 'registration-defaults', depth: 0, req })
      expect([again.cycle_template, again.bridge_template, again.workshop_template]).toEqual([
        seeded.cycle_template,
        seeded.bridge_template,
        seeded.workshop_template,
      ])
    } finally {
      await killTransaction(req)
    }
  })

  it('never writes the shared registration defaults', async () => {
    expect(await payload.findGlobal({ slug: 'registration-defaults', depth: 0 })).toEqual(shared)
  })
})
