import type { FieldHook, NamedGroupField } from 'payload'

import { WEEKDAYS } from '@/lib/cairo-day'
import { scheduleEndDate, type Schedule } from '@/lib/schedule'
import { endAfterStart, timeOfDay } from './validators'

const WEEKDAY_LABELS: Record<(typeof WEEKDAYS)[number], string> = {
  sat: 'Saturday',
  sun: 'Sunday',
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
}

/**
 * Pattern-only end date. Courses recompute it with their sessions in a
 * collection hook, since a field hook can't see them.
 */
export const computeEndDate: FieldHook = ({ siblingData }) =>
  scheduleEndDate(siblingData as Schedule)

/**
 * How something meets: a start date, a number of weeks and weekly slots in
 * Cairo wall-clock time (ADR 0002). Dates come from `expandSchedule()`.
 */
export const scheduleField = (): NamedGroupField => ({
  name: 'schedule',
  type: 'group',
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'start_date',
          type: 'date',
          admin: { width: '40%', date: { pickerAppearance: 'dayOnly' } },
        },
        {
          name: 'start_precision',
          type: 'select',
          defaultValue: 'day',
          options: [
            { label: 'Exact day', value: 'day' },
            { label: 'Week only', value: 'week' },
          ],
          admin: {
            width: '30%',
            description: 'Week only keeps it off the calendar.',
          },
        },
        { name: 'weeks', type: 'number', min: 1, max: 52, admin: { width: '30%' } },
      ],
    },
    {
      name: 'slots',
      type: 'array',
      labels: { singular: 'Slot', plural: 'Slots' },
      admin: { description: 'Weekly meeting times, in Cairo time.' },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'weekday',
              type: 'select',
              required: true,
              options: WEEKDAYS.map((value) => ({ label: WEEKDAY_LABELS[value], value })),
              admin: { width: '30%' },
            },
            {
              name: 'start_time',
              type: 'text',
              required: true,
              validate: timeOfDay,
              admin: { width: '20%', placeholder: '19:00' },
            },
            {
              name: 'end_time',
              type: 'text',
              required: true,
              validate: (value: unknown, { siblingData }: { siblingData: Record<string, unknown> }) => {
                const time = timeOfDay(value)
                return time === true ? endAfterStart(value, siblingData.start_time) : time
              },
              admin: { width: '20%', placeholder: '21:00' },
            },
            { name: 'label', type: 'text', localized: true, admin: { width: '30%' } },
          ],
        },
      ],
    },
    {
      name: 'end_date',
      type: 'date',
      admin: {
        readOnly: true,
        date: { pickerAppearance: 'dayOnly' },
        description: 'Worked out from the schedule.',
      },
      hooks: { beforeChange: [computeEndDate] },
    },
    {
      name: 'note',
      type: 'textarea',
      localized: true,
      admin: { description: 'One-off exceptions, e.g. "hybrid for the first 6 weeks, then online".' },
    },
  ],
})
