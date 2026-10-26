/** Limits the composer shows and postCreate enforces, shared by both sides. */
export const EVENT_LOCATION_MAX = 200
/** An event's name fits on two lines of its card. */
export const EVENT_TITLE_MAX = 100
export const VOTE_OPTIONS = { min: 2, max: 10, length: 120 } as const
/** Of the posts linked to a session by the older field, the kinds that show the whole session card; the others show a small chip. */
export const SESSION_CARD_KINDS: readonly string[] = ['announcement']
