import { CAIRO } from '@/lib/cairo-day'

/** Every digest, daily and weekly, goes out at this Cairo wall-clock hour. */
export const DIGEST_HOUR = 16

/** Weekly digests go out on this Cairo weekday. */
export const WEEKLY_DAY = 'Sun'

export type DigestFrequency = 'daily' | 'weekly'

export const PERIOD_MS: Record<DigestFrequency, number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
}

const clock = new Intl.DateTimeFormat('en-US', {
  timeZone: CAIRO,
  hourCycle: 'h23',
  hour: '2-digit',
  weekday: 'short',
})

/**
 * The hour and weekday on a Cairo clock at that instant. The zone's own rules
 * decide daylight saving, so 16:00 follows Cairo through the year.
 */
export const cairoClock = (now: Date): { hour: number; weekday: string } => {
  const part = (type: string) => clock.formatToParts(now).find((p) => p.type === type)?.value ?? ''
  return { hour: Number(part('hour')), weekday: part('weekday') }
}

/**
 * Which digests this moment sends: none outside the Cairo digest hour, the
 * daily one inside it, and the weekly one too on Sunday.
 */
export const digestsDueAt = (now: Date): DigestFrequency[] => {
  const { hour, weekday } = cairoClock(now)
  if (hour !== DIGEST_HOUR) return []
  return weekday === WEEKLY_DAY ? ['daily', 'weekly'] : ['daily']
}

/** The start of the clock hour that holds `now`: Cairo's offset is whole hours. */
export const hourStart = (now: Date): Date =>
  new Date(Math.floor(now.getTime() / 3_600_000) * 3_600_000)
