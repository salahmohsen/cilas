import type { ArrayField, TextFieldSingleValidation } from 'payload'
import { text } from 'payload/shared'

import { cairoDay } from '@/lib/cairo-day'
import type { Meeting } from '@/lib/meetings'
import { endAfterStart, timeOfDay } from './validators'

/**
 * What is wrong with a meeting, or true. The one check for the shape of a
 * meeting (ADR 0011): a real Cairo day, and either no times (all day) or a
 * start and an end in `HH:MM`, the end after the start.
 */
export const meetingProblem = (
  field: keyof Meeting,
  meeting: Partial<Record<keyof Meeting, unknown>>,
): true | string => {
  const { date, start_time: start, end_time: end } = meeting
  if (field === 'date')
    return typeof date === 'string' && cairoDay(date) === date
      ? true
      : 'Use a real day as YYYY-MM-DD, e.g. 2026-03-03.'
  if (!start && !end) return true
  const value = field === 'start_time' ? start : end
  if (!value) return 'Give both a start and an end time, or neither for all day.'
  const time = timeOfDay(value)
  if (time !== true) return time
  return field === 'end_time' ? endAfterStart(end, start) : true
}

const meetingCheck =
  (field: keyof Meeting): TextFieldSingleValidation =>
  (value, options) => {
    // Payload's own text checks (required, length) first.
    const base = text(value, options)
    if (base !== true) return base
    return meetingProblem(field, {
      ...(options.siblingData as Partial<Meeting>),
      [field]: value,
    })
  }

/** When something meets: `meetings[]`, shared by sessions and, later, events. */
// A function, so each collection gets its own copy: Payload sanitizes field configs in place.
export const meetingsField = (): ArrayField => ({
  name: 'meetings',
  type: 'array',
  labels: { singular: 'Meeting', plural: 'Meetings' },
  admin: {
    description: 'Cairo time. Leave both times empty for an all-day meeting.',
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'date',
          type: 'text',
          required: true,
          index: true,
          validate: meetingCheck('date'),
          admin: { width: '40%', placeholder: '2026-03-03' },
        },
        {
          name: 'start_time',
          type: 'text',
          validate: meetingCheck('start_time'),
          admin: { width: '30%', placeholder: '19:00' },
        },
        {
          name: 'end_time',
          type: 'text',
          validate: meetingCheck('end_time'),
          admin: { width: '30%', placeholder: '21:00' },
        },
      ],
    },
  ],
})
