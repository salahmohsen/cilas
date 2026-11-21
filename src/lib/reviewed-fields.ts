import type { REVIEWED } from './reviewed-collections'

export type ReviewedCollection = (typeof REVIEWED)[number]['collection']

/** The fields review covers: every top-level field an owner may write that review checks. */
export const REVIEWED_FIELDS: Record<ReviewedCollection, readonly string[]> = {
  articles: [
    'title',
    'cover_image',
    'requested_tier',
    'body',
    'authors',
    'credits',
    'translation',
    'tags',
    'related_articles',
    'meta',
  ],
  courses: [
    'cover_image',
    'title',
    'subtitle',
    'epigraph',
    'description',
    'fellows',
    'course_type',
    'location',
    'teaching_languages',
    'language_note',
    'bibliography',
    'facilitator_note',
    'content_warning',
    'syllabus_tentative',
    'applicant_questions',
    'meta',
  ],
  publications: [
    'cover_image',
    'title',
    'subtitle',
    'intro',
    'kind',
    'articles',
    'editors',
    'credits',
    'produced_by',
    'license',
    'print_edition_url',
    'meta',
  ],
}

/** Owner-writable fields that review does not cover, each with its reason. */
export const NOT_REVIEWED: Record<ReviewedCollection | 'all', readonly string[]> = {
  all: [
    'review', // the review state itself
    'last_edited_by', // set by a hook
    'updatedAt', // timestamp
    'createdAt', // timestamp
    '_status', // the draft or published flag
  ],
  articles: [
    'publications', // a join: it reads the publications' own articles field
  ],
  courses: [
    'syllabus', // a join to the syllabus rows
    'enrollments', // a join to the enrollment rows
    'first_day', // kept from the sessions
    'last_day', // kept from the sessions
    'sessions', // old hidden read-only field; sessions have no review (ADR 0011)
    'schedule', // old hidden read-only field; sessions have no review (ADR 0011)
  ],
  publications: [],
}
