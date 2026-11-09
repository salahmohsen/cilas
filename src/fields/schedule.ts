import type { Field, FieldHook, NamedGroupField, TextFieldSingleValidation } from 'payload'
import { text } from 'payload/shared'

import { WEEKDAYS } from '@/lib/cairo-day'
import { scheduleEndDate, type Schedule, type SessionDates } from '@/lib/schedule'
import { endAfterStart, timeOfDay } from './validators'

export const WEEKDAY_LABELS: Record<(typeof WEEKDAYS)[number], string> = {
  sat: 'Saturday',
  sun: 'Sunday',
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
}

/**
 * The last meeting that isn't cancelled. Payload doesn't merge stored data into
 * a field's `beforeChange`, so the incoming values are laid over the previous
 * ones; a partial update then keeps its date. When the document has top-level
 * `sessions` they are counted too, so no collection hook is needed. Collection
 * hooks run before field hooks, so one could not override this anyway.
 */
export const computeEndDate: FieldHook = ({ siblingData, previousSiblingDoc, data, originalDoc }) =>
  scheduleEndDate(
    { ...previousSiblingDoc, ...siblingData } as Schedule,
    (data?.sessions ?? originalDoc?.sessions) as SessionDates[] | undefined,
  )

/** Cairo wall-clock start and end, shared by slots and moved session dates. */
export const timeRangeFields = (width = '20%'): Field[] => [
  {
    name: 'start_time',
    type: 'text',
    required: true,
    validate: timeOfDay,
    admin: { width, placeholder: '19:00' },
  },
  {
    name: 'end_time',
    type: 'text',
    required: true,
    // Payload's text checks (required, length) first, then the time rules.
    validate: ((value, options) => {
      const base = text(value, options)
      if (base !== true) return base
      const time = timeOfDay(value)
      return time === true
        ? endAfterStart(value, (options.siblingData as Record<string, unknown>).start_time)
        : time
    }) satisfies TextFieldSingleValidation,
    admin: { width, placeholder: '21:00' },
  },
]

/**
 * How something meets: a start date, a number of weeks and weekly slots in
 * Cairo wall-clock time (ADR 0002). Dates come from `expandSchedule()`.
 */
export const scheduleField = ({ event = false }: { event?: boolean } = {}): NamedGroupField => ({
  name: 'schedule',
  ...(event ? { label: 'When' } : {}),
  type: 'group',
  fields: [
    ...(event
      ? [
          {
            name: 'mode',
            label: 'Timing',
            type: 'select' as const,
            defaultValue: 'single',
            options: [
              { label: 'One date', value: 'single' },
              { label: 'Repeating', value: 'recurring' },
            ],
            admin: {
              description:
                'A screening or talk needs only one date and time. Agenda segments are optional.',
            },
          },
        ]
      : []),
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
        {
          name: 'weeks',
          type: 'number',
          min: 1,
          max: 52,
          admin: {
            description: 'How long it runs, e.g. 8. With the start date it sets the end date.',
            width: '30%',
            ...(event
              ? { condition: (_: unknown, sibling: Schedule) => sibling?.mode !== 'single' }
              : {}),
          },
        },
      ],
    },
    ...(event
      ? [
          {
            type: 'row' as const,
            admin: { condition: (_: unknown, sibling: Schedule) => sibling?.mode === 'single' },
            fields: ['start_time', 'end_time'].map((name): Field => ({
              name,
              type: 'text',
              admin: {
                width: '50%',
                placeholder: name === 'start_time' ? '19:00' : '21:00',
                description: '24-hour Cairo time. Leave both empty if only the date is known.',
              },
              validate: ((value, options) => {
                const sibling = options.siblingData as Schedule
                if (sibling.mode !== 'single') return true
                if (!value && !sibling.start_time && !sibling.end_time) return true
                const valid = timeOfDay(value)
                if (valid !== true) return valid
                if (!sibling.start_date) return 'Choose the event date before adding a time.'
                return name === 'end_time' ? endAfterStart(value, sibling.start_time) : true
              }) satisfies TextFieldSingleValidation,
            })),
          },
        ]
      : []),
    {
      name: 'slots',
      type: 'array',
      labels: { singular: 'Slot', plural: 'Slots' },
      admin: {
        description: 'Weekly meeting times, in Cairo time.',
        ...(event
          ? { condition: (_: unknown, sibling: Schedule) => sibling?.mode !== 'single' }
          : {}),
      },
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
            ...timeRangeFields(),
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
      admin: {
        description: 'One-off exceptions, e.g. "hybrid for the first 6 weeks, then online".',
      },
    },
  ],
})
