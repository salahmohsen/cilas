/** How a session is named and linked, in one place for the syllabus, the drawer and the calendar. */

/** A session's name: its own title, or its unit ("Session 3") when it has none. */
export const sessionTitleOf = (title: string | null | undefined, unit: string): string =>
  title?.trim() || unit

/**
 * "Session 3 · Title", or "Session 3" with no title. The title sits in
 * Unicode isolates, so an English title in an Arabic line keeps its order.
 */
export const sessionCaption = (unit: string, title: string | null | undefined): string => {
  const own = title?.trim()
  return own ? `${unit} · ⁨${own}⁩` : unit
}

/** The id of a session's row in its course's syllabus: the same in every language. */
export const sessionAnchor = (sessionId: string | number): string => `session-${sessionId}`
