import { getPayload } from 'payload'
import config from '../../src/payload.config.js'
import type { Course } from '../../src/payload-types.js'

export async function applicationFixture() {
  const payload = await getPayload({ config })
  const suffix = crypto.randomUUID().slice(0, 8)
  const form = await payload.create({
    collection: 'forms',
    data: {
      title: `Choice test ${suffix}`,
      confirmationType: 'redirect',
      redirect: { url: 'https://example.org/thanks' },
      fields: [
        { blockType: 'text', name: 'name', label: 'Name', required: true },
        { blockType: 'email', name: 'email', label: 'Email', required: true },
        { blockType: 'text', name: 'shared', label: 'Your interests', required: true },
      ],
    },
  })
  const place = await payload.create({
    collection: 'places',
    data: { name: `Test ${suffix}`, city: `Test ${suffix}`, slug: `test-${suffix}` },
  })
  const cycle = await payload.create({
    collection: 'cycles',
    data: {
      season: 'fall',
      start_year: 2097,
      place: place.id,
      registration: { method: 'form', form: form.id },
      pricing: [
        {
          course_types: ['CORE'],
          pricing: {
            options: [{ amount: 100 }, { amount: 350, default: true }, { amount: 900 }],
            need_based_deductions: true,
            note: 'Contribution for the full course',
          },
        },
      ],
    },
  })
  const courses: Course[] = []
  for (const title of ['Writing', 'Film']) {
    const course = await payload.create({
      collection: 'courses',
      data: {
        title,
        slug: `choice-${title.toLowerCase()}-${suffix}`,
        course_type: 'CORE',
        session_unit: 'week',
        cycle: cycle.id,
        tier: 'public',
        _status: 'published',
        registration: { mode: 'follow_cycle' },
        applicant_questions: [
          {
            blockType: 'text',
            name: 'reason',
            label: `Why ${title.toLowerCase()}?`,
            required: true,
          },
        ],
      },
    })
    courses.push(course)
    await payload.update({
      collection: 'courses',
      id: course.id,
      locale: 'ar',
      data: {
        title: title === 'Writing' ? 'الكتابة' : 'السينما',
        applicant_questions: [
          {
            ...course.applicant_questions![0],
            label: title === 'Writing' ? 'لماذا الكتابة؟' : 'لماذا السينما؟',
          },
        ],
      },
    })
  }
  return { payload, form, place, cycle, courses, suffix }
}

export async function removeApplicationFixture(f: Awaited<ReturnType<typeof applicationFixture>>) {
  const { payload, form, courses, cycle, place } = f
  const submissions = await payload.find({
    collection: 'form-submissions',
    where: { form: { equals: form.id } },
    limit: 0,
  })
  for (const submission of submissions.docs) {
    await payload.delete({
      collection: 'notifications',
      where: { link: { equals: `/admin/collections/form-submissions/${submission.id}` } },
    })
    await payload.delete({ collection: 'form-submissions', id: submission.id })
  }
  for (const c of courses) await payload.delete({ collection: 'courses', id: c.id })
  await payload.delete({ collection: 'cycles', id: cycle.id })
  await payload.delete({ collection: 'places', id: place.id })
  await payload.delete({ collection: 'forms', id: form.id })
  await payload.destroy()
}
