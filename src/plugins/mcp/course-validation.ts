import { validateContributionOptions } from '@/lib/pricing'
import type { z } from 'zod/v3'
import { WEEKDAY_LABELS } from '@/fields/schedule'
import { cairoDay, weekdayOf } from '@/lib/cairo-day'
import { expandSchedule, type Schedule } from '@/lib/schedule'
import { timeOfDay, endAfterStart, httpUrl } from '@/fields/validators'
import { ToolInputError } from './errors'

type Data = z.infer<z.ZodObject<z.ZodRawShape>>
const validate = (value: true | string, path: string) => {
  if (value !== true) throw new ToolInputError(`${path}: ${value}`)
}

export function validateCourse(input: Data) {
  const s = input.schedule as Schedule | undefined
  if (s?.start_date && s.slots?.length && s.start_precision !== 'week') {
    const day = cairoDay(s.start_date)!
    const weekday = weekdayOf(day)
    if (!s.slots.some((slot) => slot.weekday === weekday))
      throw new ToolInputError(
        `Schedule conflict: start date ${day} is ${WEEKDAY_LABELS[weekday]}, but weekly slots specify ${s.slots.map((slot) => WEEKDAY_LABELS[slot.weekday]).join(', ')}. Ask the person which is correct. Nothing was saved.`,
      )
  }
  for (const row of [
    ...(s?.slots ?? []),
    ...(input.sessions ?? []).flatMap((session: Data) => session.dates ?? []),
  ]) {
    validate(timeOfDay(row.start_time), 'start_time')
    validate(timeOfDay(row.end_time), 'end_time')
    validate(endAfterStart(row.end_time, row.start_time), 'end_time')
  }
  if (s && s.start_date && !cairoDay(s.start_date))
    throw new ToolInputError('schedule.start_date is not a real date')
  if (s) expandSchedule(s, input.sessions)
  validate(validateContributionOptions(input.pricing_override?.options), 'pricing_override.options')
  if (input.registration?.method === 'form' && !input.registration.form)
    throw new ToolInputError('registration.form: Choose a registration form.')
  if (input.registration?.method === 'external' && !input.registration.url)
    throw new ToolInputError('registration.url: Enter the external registration URL.')
  if (input.registration?.url) validate(httpUrl(input.registration.url), 'registration.url')
  if (input.registration?.method === 'external' && input.applicant_questions?.length)
    throw new ToolInputError(
      'Applicant questions are not used with external registration. Remove them or choose a site form.',
    )
}
