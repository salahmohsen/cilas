/**
 * The names the private search shares between the engine and the database:
 * the alias readers query, the pattern every generation behind it follows, and
 * the tables the raw SQL reads (created by the migrations).
 */
export const ALIAS = 'spaces_search'

export const GENERATION_PATTERN = new RegExp(`^${ALIAS}_[a-f0-9]{32}$`)

export const generationName = (id: string) => `${ALIAS}_${id.replaceAll('-', '')}`

export const STATE_TABLE = 'spaces_search_state'
export const OUTBOX_TABLE = 'spaces_search_outbox'
export const RATE_TABLE = 'spaces_search_rate'
