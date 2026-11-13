import type { Payload } from 'payload'

import { fillSource, type Localized, type OldCourse, type Versioned } from './course-sessions-plan'

/**
 * Every course as the fill reads it, for the fill and verify scripts, so both
 * plan from the same data (`fillSource`: a newer pending draft wins).
 */
export type CourseSource = {
  /** The course row. */
  course: OldCourse &
    Versioned & {
      timing_note?: Localized<string>
      first_day?: string | null
      last_day?: string | null
    }
  /** What the fill plans from: the course row, or its latest draft. */
  source: OldCourse
  /** The latest version, which a publish copies over the course row. */
  latest: { id: number; timing_note: Localized<string> } | null
  fromDraft: boolean
}

type Version = {
  id: number
  parent: number
  version: Omit<OldCourse, 'id'> & Versioned & { timing_note?: Localized<string> }
}

export const loadCourseSources = async (payload: Payload): Promise<CourseSource[]> => {
  const { docs } = await payload.find({
    collection: 'courses',
    locale: 'all',
    depth: 0,
    pagination: false,
    overrideAccess: true,
    sort: 'id',
    select: {
      schedule: true,
      sessions: true,
      timing_note: true,
      first_day: true,
      last_day: true,
      _status: true,
    },
  })
  const { docs: versions } = await payload.findVersions({
    collection: 'courses',
    where: { latest: { equals: true } },
    locale: 'all',
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })
  const latestOf = new Map(
    (versions as unknown as Version[]).map((v) => [Number(v.parent), v] as const),
  )

  return (docs as unknown as CourseSource['course'][]).map((course) => {
    const latest = latestOf.get(course.id)
    const draft = latest ? { ...latest.version, id: course.id } : null
    const source = fillSource(course, draft)
    return {
      course,
      source,
      latest: latest ? { id: latest.id, timing_note: latest.version.timing_note ?? null } : null,
      fromDraft: source !== course,
    }
  })
}
