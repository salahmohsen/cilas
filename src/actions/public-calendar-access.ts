'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import * as z from 'zod'

import { localeOf } from '@/i18n/routing'
import { isAdminUser } from '@/access'
import { currentReader } from '@/lib/reader'
import { relId } from '@/lib/relation'
import { spaceHref } from '@/lib/space-ref'

export async function publicCalendarLinks(courseIds: string[], locale = 'en') {
  const user = await currentReader()
  if (!user) return { canEdit: false, spaces: {} as Record<string, string> }
  const ids = z.array(z.string().regex(/^\d+$/)).parse(courseIds)
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'spaces',
    where: { and: [{ kind: { equals: 'course' } }, { course: { in: ids.map(Number) } }] },
    depth: 1,
    pagination: false,
    select: { kind: true, course: true },
    populate: { courses: { slug: true } },
    user,
    overrideAccess: false,
  })
  return {
    canEdit: isAdminUser(user),
    spaces: Object.fromEntries(
      docs.flatMap((space) => {
        const path = spaceHref(space, typeof space.course === 'object' ? space.course : null, {
          locale: localeOf(locale),
        })
        return [[String(relId(space.course)), path]]
      }),
    ),
  }
}
