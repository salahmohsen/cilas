import { locationUrl } from '@/lib/space-event'
import type { EventPosting, Membership, PostingLevel, SpaceKind } from '@/lib/spaces'

/** Every post kind the posts collection stores. `question` is kept for older rows. */
export const POST_KINDS = ['discussion', 'question', 'announcement', 'event', 'vote'] as const

export const COMPOSER_KINDS = [
  'discussion',
  'event',
  'vote',
  'announcement',
] as const satisfies readonly (typeof POST_KINDS)[number][]
export type ComposerKind = (typeof COMPOSER_KINDS)[number]

export const ABOUT_MAX = 800
export const EVENT_LOCATION_MAX = 200
/** An event's name fits on two lines of its card. */
export const EVENT_TITLE_MAX = 100
export const VOTE_OPTIONS = { min: 2, max: 10, length: 120 } as const
/** Of the posts linked to a session by the older field, the kinds that show the whole session card; the others show a small chip. */
export const SESSION_CARD_KINDS: readonly string[] = ['announcement']

/** A course space turns read-only this many days after its last meeting (spec §11). */
const READ_ONLY_AFTER_DAYS = 14

export type PostFile = { data: Buffer; mimetype: string; name: string; size: number }

export const voteClosed = (closesAt: string | null | undefined, now = new Date()) =>
  !!closesAt && new Date(closesAt).getTime() <= now.getTime()

export const readOnly = (
  space: { kind: SpaceKind; reopened?: boolean | null },
  lastMeeting: string | null,
  daysSinceLast: number | null,
): boolean => {
  if (space.kind !== 'course') return false
  if (space.reopened) return false
  if (!lastMeeting) return false
  return (daysSinceLast ?? 0) >= READ_ONLY_AFTER_DAYS
}

export const postingAllows = (postingLevel: PostingLevel, role: string, kind: string): boolean => {
  const isModerator = role === 'moderator'
  if (kind === 'announcement') return isModerator
  return postingLevel === 'open' || isModerator
}

export const eventsAllow = (events: EventPosting | null | undefined, role: string): boolean =>
  (events ?? 'members') === 'members' || role === 'moderator'

/** Whether this member may comment (spec §7): only `fellows_only` keeps members to reading. */
export const mayComment = (membership: Membership, posting: PostingLevel = 'open'): boolean =>
  membership.role === 'moderator' || (membership.role !== 'none' && posting !== 'fellows_only')

/**
 * The introduction gate (W20): a member of a course or cohort space reads
 * only its intro post until they comment on it. Moderators (admins, the
 * course's fellows, the programme's residential fellows) never wait. A space
 * without a live intro post has nothing to gate on.
 */
export const introGated = (
  kind: SpaceKind,
  role: Membership['role'],
  introPost: number | null,
  introduced: boolean,
): boolean =>
  (kind === 'course' || kind === 'cohort') && role === 'member' && introPost != null && !introduced

/**
 * An event's place and times once checked: a place within the limit (an
 * address is stored as the full address), a real start that has not passed
 * (when `fresh`), and an end, if any, after the start.
 */
export const eventTimes = (
  event: { location: string; startsAt: string; endsAt?: string | null },
  now: Date,
  fresh: boolean,
): { location: string; startsAt: string; endsAt: string | null } | null => {
  const text = event.location.trim()
  const location = locationUrl(text) ?? text
  const starts = new Date(event.startsAt)
  if (!location || location.length > EVENT_LOCATION_MAX) return null
  if (Number.isNaN(starts.getTime()) || (fresh && starts.getTime() < now.getTime())) return null
  let endsAt: string | null = null
  if (event.endsAt) {
    const ends = new Date(event.endsAt)
    if (Number.isNaN(ends.getTime()) || ends.getTime() <= starts.getTime()) return null
    endsAt = ends.toISOString()
  }
  return { location, startsAt: starts.toISOString(), endsAt }
}

/** An event's name once checked: trimmed, null when empty, undefined when it is too long. */
export const eventTitleOf = (title: string | null | undefined): string | null | undefined => {
  const text = (title ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return null
  return text.length > EVENT_TITLE_MAX ? undefined : text
}

/** A vote's option labels once checked: trimmed, two to ten, distinct, none too long; null when they break a rule. */
export const voteLabels = (labels: string[]): string[] | null => {
  const options = labels.map((o) => o.trim()).filter(Boolean)
  const distinct = new Set(options.map((o) => o.toLocaleLowerCase()))
  if (distinct.size !== options.length) return null
  if (options.length < VOTE_OPTIONS.min || options.length > VOTE_OPTIONS.max) return null
  if (options.some((o) => o.length > VOTE_OPTIONS.length)) return null
  return options
}

/** When a vote closes, once checked: null for never, undefined for a time that is not real or has passed. */
export const closingOf = (raw: string | null | undefined, now: Date): string | null | undefined => {
  if (!raw) return null
  const at = new Date(raw)
  if (Number.isNaN(at.getTime()) || at.getTime() <= now.getTime()) return undefined
  return at.toISOString()
}

export type PostShape =
  | { kind: 'discussion' | 'announcement' }
  | {
      kind: 'event'
      /** `title` is the name on the card; without one the card shows the body's first line */
      event: { title?: string | null; location: string; startsAt: string; endsAt?: string | null }
      cover?: PostFile | null
    }
  | {
      kind: 'vote'
      vote: {
        options: string[]
        multiple: boolean
        anonymous?: boolean
        /** When voting closes; null or left out keeps it open */
        closesAt?: string | null
      }
    }

/**
 * The extra columns an event or a vote stores, or null when they break a
 * rule: an event needs a place, a start that has not passed and, if given, a later end; a vote needs
 * two to ten distinct options and, if given, a closing time that has not passed.
 */
export const shapeData = (shape: PostShape, now = new Date()): Record<string, unknown> | null => {
  switch (shape.kind) {
    case 'discussion':
    case 'announcement':
      return {}
    case 'event': {
      const times = eventTimes(shape.event, now, true)
      const title = eventTitleOf(shape.event.title)
      if (!times || title === undefined) return null
      return {
        ...(title ? { event_title: title } : {}),
        event_location: times.location,
        event_starts_at: times.startsAt,
        event_ends_at: times.endsAt,
      }
    }
    case 'vote': {
      const options = voteLabels(shape.vote.options)
      const closesAt = closingOf(shape.vote.closesAt, now)
      if (!options || closesAt === undefined) return null
      return {
        vote_options: options.map((label) => ({ label })),
        vote_multiple: shape.vote.multiple,
        vote_anonymous: shape.vote.anonymous === true,
        vote_closes_at: closesAt,
      }
    }
  }
}
