import type { ArrayField, TextFieldSingleValidation } from 'payload'
import { text } from 'payload/shared'

import { cairoDay } from '@/lib/cairo-day'
import type { Meeting } from '@/lib/meetings'
import { END_AFTER_START, endAfterStart, TIME_OF_DAY, timeOfDay } from './validators'

/**
 * What is wrong with a meeting, as a code a page words in its own language,
 * or true. The one check for the shape of a meeting (ADR 0011): a real Cairo
 * day, and either no times (all day) or a start and an end in `HH:MM`, the
 * end after the start.
 */
export type MeetingIssue = 'day' | 'both-times' | 'time' | 'order'

export const meetingIssue = (
  field: keyof Meeting,
  meeting: Partial<Record<keyof Meeting, unknown>>,
): true | MeetingIssue => {
  const { date, start_time: start, end_time: end } = meeting
  if (field === 'date') return typeof date === 'string' && cairoDay(date) === date ? true : 'day'
  if (!start && !end) return true
  const value = field === 'start_time' ? start : end
  if (!value) return 'both-times'
  if (timeOfDay(value) !== true) return 'time'
  return field === 'end_time' && endAfterStart(end, start) !== true ? 'order' : true
}

const MEETING_PROBLEMS: Record<MeetingIssue, string> = {
  day: 'Use a real day as YYYY-MM-DD, e.g. 2026-03-03.',
  'both-times': 'Give both a start and an end time, or neither for all day.',
  time: TIME_OF_DAY,
  order: END_AFTER_START,
}

/** `meetingIssue` in the admin's and the API's words. */
export const meetingProblem = (
  field: keyof Meeting,
  meeting: Partial<Record<keyof Meeting, unknown>>,
): true | string => {
  const issue = meetingIssue(field, meeting)
  return issue === true ? true : MEETING_PROBLEMS[issue]
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
    description:
      'When it meets, in Cairo time: one row a meeting. Leave both times empty for an all-day meeting.',
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
  ],
})
