import type {
  Article,
  Course,
  Event,
  Publication,
  SiteSetting,
  Space,
  User,
} from '@/payload-types'
import type { CourseType } from '@/fields/course-type'

/**
 * Lexical node. `type` is a string, never `any` — the shape mirrors the
 * richText value Payload generates, so a LexicalJSON is assignable as-is.
 */
export type LexicalChild = { type: string; version: number; [k: string]: unknown }

export type LexicalJSON = {
  root: {
    type: string
    children: LexicalChild[]
    direction: 'ltr' | 'rtl' | null
    format: 'left' | 'start' | 'center' | 'right' | 'end' | 'justify' | ''
    indent: number
    version: number
  }
  [k: string]: unknown
}

/** Strip server-managed fields so a seed reads as a plain writable document. */
export type Draft<T> = Omit<T, 'id' | 'updatedAt' | 'createdAt'>

/* ================================================================== users */

/**
 * One fixture person. Every fixture person also gets a login account, keyed by
 * `email`, so local development can sign in as anyone.
 */
export type UserSeed = {
  email: string
  name: string
  /** Arabic name, written in a follow-up `locale: 'ar'` update. */
  name_ar: string
  /** Stored as plain text here; converted to Lexical by the seeder. */
  bio: string
  /** Arabic bio, written in the same follow-up `locale: 'ar'` update. */
  bio_ar: string
  roles: User['roles']
  password?: string
}

/* ====================================================== fields of study */

export type FieldOfStudySeed = {
  title: string
  /** Written in a follow-up `locale: 'ar'` update. */
  title_ar: string
}

/* ================================================================ cycles */

export type CycleSeed = {
  season: 'fall' | 'winter' | 'spring' | 'summer'
  start_year: number
  /** Space name, resolved to an id. */
  space: string
  start_date: string
  deadline: string
}

/* ============================================================ programmes */

export type ProgrammeSeed = {
  kind: 'bridge' | 'women_studies' | 'residency'
  title: string
  /** Cycle keys like `fall-2025`, resolved to ids. */
  cycles: string[]
  components: Array<{ label: string; cycle: string; course_types: CourseType[] }>
  weekly_hours?: number
  self_directed_study?: boolean
  requirements?: string
  pricing?: {
    min: number
    need_based_deductions?: boolean
    payment_plans?: Array<{ label: string; installments: Array<{ amount: number }> }>
  }
}

/* ================================================================ courses */

export type MaterialType = 'reading' | 'watch' | 'listen' | 'prompt' | 'other'

export type MaterialSeed = {
  type: MaterialType
  title?: string | null
  note?: string | null
  /** youtube / vimeo / article / open-access pdf url */
  href?: string | null
}

type SessionDraft = NonNullable<Draft<Course>['sessions']>[number]

export type SessionSeed = Omit<SessionDraft, 'description' | 'bibliography'> & {
  description?: string
  bibliography?: MaterialSeed[]
}

export type ScheduleSeed = NonNullable<Draft<Course>['schedule']>

export type CourseSeed = Omit<
  Draft<Course>,
  'description' | 'sessions' | 'fellows' | 'cycle' | 'slug' | 'schedule' | 'session_unit'
> & {
  description?: string
  sessions?: SessionSeed[]
  schedule?: ScheduleSeed
  /** Defaults to `session`. */
  session_unit?: Course['session_unit']
  /** User emails, resolved to user ids. */
  fellows: string[]
  /** Cycle key like `fall-2025`, resolved to a cycle id. */
  cycle: string
  /** Arabic title, written in a follow-up `locale: 'ar'` update. */
  title_ar?: string
}

/* ============================================================= governance */

export type GovernanceSeed = {
  /** The linked person must already exist in `usersData`. */
  email: string
  role: 'advisor' | 'trustee'
  board_role?: string
  advises_on?: string
}

/* =============================================================== articles */

export type ArticleSeed = Omit<
  Draft<Article>,
  'body' | 'authors' | 'slug' | 'review' | 'requested_tier'
> & {
  /** String => one paragraph; array => one paragraph per entry. */
  body?: string | string[]
  /** Arabic title, written in a follow-up `locale: 'ar'` update. */
  title_ar: string
  /** Arabic body, written in the same follow-up `locale: 'ar'` update. */
  body_ar?: string | string[]
  /** Fixture email of the author's person. */
  author_email: string
}

/* ================================================================== press */

export type PressSeed = {
  title: string
  /** Partner name, resolved to an id. */
  outlet: string
  url: string
  published_date: string
  date_precision?: 'day' | 'month' | 'year'
  language?: 'ar' | 'en' | 'de' | 'fr' | 'other'
}

/* ================================================================= events */

export type EventSeed = Omit<Draft<Event>, 'description' | 'slug' | 'fellows'> & {
  description?: string
  /** User emails, resolved to user ids. */
  fellows?: string[]
}

/* =============================================================== partners */

export type PartnerSeed = {
  name: string
  kind: Array<'funder' | 'co_host' | 'outlet' | 'other'>
  url?: string
}

/* ================================================================= spaces */

export type SpaceSeed = Omit<Draft<Space>, 'description' | 'slug'> & {
  description?: string
}

/* ============================================================ publications */

export type PublicationSeed = Omit<
  Draft<Publication>,
  'intro' | 'subtitle' | 'articles' | 'cover_image' | 'slug' | 'funders' | 'foreword'
> & {
  /** Plain text; converted to Lexical by the seeder. */
  intro?: string | string[]
  subtitle?: string
  /** English titles of the member articles, resolved to ids by the seeder. */
  articles?: string[]
  /** Partner names, resolved to ids. */
  funders?: string[]
  /** The first article doubles as the foreword. */
  foreword?: boolean
  /** Written in a follow-up `locale: 'ar'` update. */
  title_ar?: string
  subtitle_ar?: string
  intro_ar?: string | string[]
}

/* ========================================================== site settings */

export type SiteSettingsSeed = Omit<Draft<SiteSetting>, 'footer_text' | 'support_us'> & {
  footer_text?: string
  support_us?: string
}

/* =============================================================== context */

/** Resolved ids, keyed by a stable natural key (email, title, label). */
export type IdMap = Record<string, number>

export type SeedContext = {
  users: IdMap
  /** Fixture emails, resolved to person ids. */
  people: IdMap
  cycles: IdMap
  courses: IdMap
  programmes: IdMap
  /** Publication titles, resolved to ids. */
  publications: IdMap
  /** Space names, resolved to ids. */
  spaces: IdMap
  /** Partner names, resolved to ids. */
  partners: IdMap
}

export const createSeedContext = (): SeedContext => ({
  users: {},
  people: {},
  cycles: {},
  courses: {},
  programmes: {},
  publications: {},
  spaces: {},
  partners: {},
})
