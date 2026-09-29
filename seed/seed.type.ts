import type {
    Article,
    ArticleCollection,
    Course,

    Event,
    Press,
    Programme,
    SiteSetting,
    Space,
    User,
} from '@/payload-types'

/**
 * Lexical node. `type` is a string, never `any` — the shape mirrors the
 * richText value Payload generates, so a LexicalJSON is assignable as-is.
 */
export type LexicalChild = { type: string; version: number;[k: string]: unknown }

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

export type UserSeed = Omit<
    User,
    'id' | 'updatedAt' | 'createdAt' | 'collection' | 'name' | 'bio'
> & {
    name: string
    /** Stored as plain text here; converted to Lexical by the seeder. */
    bio: string
    /** Arabic name, written in a follow-up `locale: 'ar'` update. */
    name_ar: string
    /** Arabic bio, written in the same follow-up `locale: 'ar'` update. */
    bio_ar: string
    password?: string
}

/* ====================================================== fields of study */

export type FieldOfStudySeed = {
    title: string
    /** Written in a follow-up `locale: 'ar'` update. */
    title_ar: string
}

/* ================================================================ cycles */

/**
 * Create-shaped on purpose: `Draft<Cycle>` allows `| null` on optional fields,
 * which makes TS resolve `payload.create` to its `draft: true` overload.
 * `courses` is omitted too — the cycle -> courses back-link is filled by the
 * course seeder.
 */
export type CycleSeed = {
    label: string
    season?: 'fall' | 'winter' | 'spring' | 'summer'
    year?: number
    mode?: 'OFFLINE' | 'ONLINE' | 'HYBRID'
}

/* ============================================================ programmes */

export type ProgrammeSeed = Omit<Draft<Programme>, 'admission_requirements' | 'cycles'> & {
    admission_requirements?: string
    /** Cycle labels, resolved to cycle ids. */
    cycles: string[]
}

/* ================================================================ courses */

export type MaterialType =
    | 'reading'
    | 'watch'
    | 'listen'
    | 'sit_with'
    | 'case_study'
    | 'prompt'
    | 'lecture'
    | 'link'

export type MaterialSeed = {
    type: MaterialType
    title?: string | null
    note?: string | null
    /** youtube / vimeo / article / open-access pdf url */
    href?: string | null
}

type SessionDraft = NonNullable<Draft<Course>['sessions']>[number]

export type SessionSeed = Omit<SessionDraft, 'description' | 'materials'> & {
    description?: string
    materials?: MaterialSeed[]
}

export type CourseSeed = Omit<
    Draft<Course>,
    'description' | 'sessions' | 'fellows' | 'fields_of_study' | 'cycle'
> & {
    description?: string
    sessions?: SessionSeed[]
    /** User emails, resolved to user ids. */
    fellows: string[]
    /** English field-of-study titles, resolved to ids. */
    fields_of_study: string[]
    /** Cycle label, resolved to a cycle id. */
    cycle: string
    /** Arabic title, written in a follow-up `locale: 'ar'` update. */
    title_ar?: string
}

/* ============================================================= governance */

export type GovernanceSeed = {
    /** The linked user must already exist in `usersData`. */
    email: string
    role: 'advisor' | 'trustee'
    board_role?: string
    advises_on?: string
}

/* =============================================================== articles */

export type ArticleSeed = Omit<Draft<Article>, 'body' | 'author'> & {
    /** String => one paragraph; array => one paragraph per entry. */
    body?: string | string[]
    /** Arabic title, written in a follow-up `locale: 'ar'` update. */
    title_ar: string
    /** Arabic body, written in the same follow-up `locale: 'ar'` update. */
    body_ar?: string | string[]
    /** Resolved to a user id. */
    author_email: string
}

/* ================================================================== press */

export type PressSeed = Draft<Press>

/* ================================================================= events */

export type EventSeed = Omit<Draft<Event>, 'description'> & {
    description?: string
}

/* ================================================================= spaces */

export type SpaceSeed = Omit<Draft<Space>, 'description'> & {
    description?: string
}

/* ==================================================== article collections */

export type ArticleCollectionSeed = Omit<
    Draft<ArticleCollection>,
    'description' | 'subtitle' | 'articles' | 'cover_image'
> & {
    /** Plain text; converted to Lexical by the seeder. */
    description?: string | string[]
    subtitle?: string
    /** English titles of the member articles, resolved to ids by the seeder. */
    articles?: string[]
    /** Written in a follow-up `locale: 'ar'` update. */
    title_ar?: string
    subtitle_ar?: string
    description_ar?: string | string[]
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
    fieldsOfStudy: IdMap
    cycles: IdMap
    courses: IdMap
    programmes: IdMap
    /** Article-collection titles, resolved to ids. */
    articleCollections: IdMap
}

export const createSeedContext = (): SeedContext => ({
    users: {},
    fieldsOfStudy: {},
    cycles: {},
    courses: {},
    programmes: {},
    articleCollections: {},
})
