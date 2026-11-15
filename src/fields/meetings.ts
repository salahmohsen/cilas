import type { ArrayField, TextFieldSingleValidation } from 'payload'
import { text } from 'payload/shared'

import { cairoDay } from '@/lib/cairo-day'
import { keepApproximate, type Meeting } from '@/lib/meetings'
import { endAfterStart, timeOfDay } from './validators'

type TimeField = Exclude<keyof Meeting, 'approximate'>

/**
 * What is wrong with a meeting, or true. The one check for the shape of a
 * meeting (ADR 0011): a real Cairo day, and either no times (all day) or a
 * start and an end in `HH:MM`, the end after the start.
 */
export const meetingProblem = (
  field: TimeField,
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
  (field: TimeField): TextFieldSingleValidation =>
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
    description:
      'When it meets, in Cairo time: one row a meeting. Leave both times empty for an all-day meeting.',
  },
  hooks: {
    // Every write path (the calendar, the session drawer, an AI assistant)
    // saves through here, so an edited meeting loses `approximate` in one place.
    beforeChange: [
      ({ value, previousValue }) =>
        Array.isArray(value)
          ? keepApproximate(previousValue as Meeting[] | undefined, value)
          : value,
    ],
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'date',
          label: 'Day',
          type: 'text',
          required: true,
          index: true,
          validate: meetingCheck('date'),
          admin: { width: '40%', placeholder: '2026-03-03' },
        },
        {
          name: 'start_time',
          label: 'Starts',
          type: 'text',
          validate: meetingCheck('start_time'),
          admin: { width: '30%', placeholder: '19:00' },
        },
        {
          name: 'end_time',
          label: 'Ends',
          type: 'text',
          validate: meetingCheck('end_time'),
          admin: { width: '30%', placeholder: '21:00' },
        },
      ],
    },
    {
      // Set only by `scripts/make-archive-meetings.ts --mark-approximate`;
      // cleared by the hook above. Hidden: a person confirms a meeting by
      // editing its day or times, not by a checkbox.
      name: 'approximate',
      type: 'checkbox',
      defaultValue: false,
      admin: { hidden: true },
    },
  ],
})
