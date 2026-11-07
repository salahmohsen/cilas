import { relId } from '@/lib/relation'
import type { Where } from 'payload'

export type ProgrammeComponent = {
  cycle?: number | { id: number } | null
  course_types?: string[] | null
}

/**
 * A component's courses are not stored: they are its cycle's courses of its
 * course types (ADR 0003). Null until both are set.
 */
export const componentCoursesWhere = (component: ProgrammeComponent): Where | null => {
  const cycle = relId(component.cycle) ?? undefined
  if (!cycle || !component.course_types?.length) return null
  return {
    and: [{ cycle: { equals: cycle } }, { course_type: { in: component.course_types } }],
  }
}
