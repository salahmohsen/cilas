import * as z from 'zod'

import { Syllabus } from './syllabus-schema'

/**
 * A reviewer's corrections to one imported course, checked against its
 * source pages and flow (plan 6.7). `set` holds only the fields that change,
 * each as its full corrected value; a localized field gives both languages
 * (null where that language has no text).
 */
const Localized = z.object({ en: z.string().nullable(), ar: z.string().nullable() })
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)

export const CourseReview = z.object({
  id: z.number().int(),
  /** What was wrong and what changed, one line each, for review/corrections.md. */
  notes: z.array(z.string()),
  set: z
    .object({
      title: z.object({ en: z.string().min(1), ar: z.string().nullable() }),
      subtitle: Localized,
      summary: Localized,
      epigraph: Localized,
      description: Localized,
      facilitator_note: Localized,
      content_warning: Localized,
      language_note: Localized,
      course_type: z.enum(['CORE', 'THEMATIC', 'LAB', 'WORKSHOP', 'SHORT']),
      location: z.array(z.enum(['OFFLINE', 'ONLINE', 'HYBRID'])),
      teaching_languages: z.array(z.enum(['ar', 'en'])),
      schedule: z
        .object({
          start_date: day.nullable(),
          weeks: z.number().int().positive().nullable(),
          slots: z.array(
            z.object({
              weekday: z.enum(['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri']),
              start_time: time,
              end_time: time,
            }),
          ),
          note: Localized,
        })
        .partial(),
    })
    .partial(),
  /** A syllabus taken from the source, replacing the course's sessions and bibliography. */
  syllabus: Syllabus.nullable(),
  /** The course's image on its source page, as an uploads/… path; null when the source has none. */
  cover: z.object({ upload: z.string().regex(/^uploads\//), alt: z.string().min(1) }).nullable(),
  /** Another course id that is the same course (same title and text) imported twice. */
  duplicate_of: z.array(z.number().int()),
})
export type CourseReview = z.infer<typeof CourseReview>

/**
 * A course the archive has but the import missed (its page held only a link
 * to an outline document, or no cycle page listed it). Created by
 * apply-reviews.ts in the cycle named by season, year and space.
 */
export const NewCourse = CourseReview.omit({ id: true, duplicate_of: true }).extend({
  legacy_url: z.string().regex(/^\/[^#]+\.html(#.+)?$/),
  cycle: z.object({
    season: z.enum(['fall', 'winter', 'spring', 'summer']),
    start_year: z.number().int(),
    space: z.enum(['al-Ghuria', 'Darb el-Labbana', 'al-Manshiya']),
    start_date: day.nullable(),
  }),
  fellows: z.array(z.string().min(1)),
  set: CourseReview.shape.set.refine((s) => s.title && s.course_type && s.description, {
    message: 'a new course needs title, course_type and description',
  }),
})
export type NewCourse = z.infer<typeof NewCourse>
