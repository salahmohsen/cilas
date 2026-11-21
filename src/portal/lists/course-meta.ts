import { cairoDay, cairoInstant } from '@/lib/cairo-day'
import { meetingsOf, type CourseMeeting, type SessionTimes } from '@/lib/meetings'

const hasEnded = (meeting: CourseMeeting, now: Date): boolean => {
  const time = meeting.end_time ?? meeting.start_time
  if (!time) {
    const day = cairoDay(meeting.date)
    return day !== null && day < cairoDay(now)!
  }
  const end = cairoInstant(meeting.date, time)
  return end !== null && new Date(end) < now
}

/**
 * The sessions of a course that count, and how many of them are over. A
 * cancelled session counts in neither. A session is held when its last
 * meeting has ended: a timed one at its end (or start) time in Cairo, an
 * all-day one from the next Cairo day. A meeting with a bad date or time has
 * not ended, and a session with no meeting is not held.
 */
export const heldCount = (
  sessions: readonly SessionTimes[],
  now: Date,
): { held: number; total: number } => {
  const live = sessions.filter((session) => !session.cancelled)
  const held = live.filter((session) => {
    const last = meetingsOf([session]).at(-1)
    return last !== undefined && hasEnded(last, now)
  })
  return { held: held.length, total: live.length }
}
