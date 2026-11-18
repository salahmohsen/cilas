'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import * as z from 'zod'

import { localeOf } from '@/i18n/routing'
import { isAdminUser } from '@/access'
import { createSession } from '@/collections/Sessions'
import { calendarContext } from '@/lib/calendar-context'
import { currentReader } from '@/lib/reader'
import { relId } from '@/lib/relation'
import { spaceHref } from '@/lib/space-ref'

/**
 * What the signed-in reader may do with the courses on the public calendar:
 * `canEdit` is the admin's Edit mode; `editable` lists the courses whose
 * sessions the reader may change (the sessions collection's own rule, the same
 * one the drawer asks); `spaces` maps each course to the space it may read.
 */
export async function publicCalendarLinks(courseIds: string[], locale = 'en') {
  const user = await currentReader()
  if (!user)
    return { canEdit: false, editable: [] as string[], spaces: {} as Record<string, string> }
  const ids = z.array(z.string().regex(/^\d+$/)).parse(courseIds)
  const payload = await getPayload({ config })
  const { req } = await calendarContext(user, locale)
  const editable = (
    await Promise.all(
      ids.map(async (id) =>
        (await createSession({ req, data: { course: Number(id) } })) === true ? [id] : [],
      ),
    )
  ).flat()
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
    editable,
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
