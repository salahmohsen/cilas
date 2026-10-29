import type { NamedGroupField, NumberFieldSingleValidation } from 'payload'
import { number } from 'payload/shared'

import { notBelow } from './validators'

/**
 * What something costs, as a range in EGP with optional payment plans.
 * Cycles hold one per course type; a course can override with
 * `pricingField({ name: 'pricing_override' })`.
 *
 * Postgres cuts identifiers at 63 characters, and the nested arrays build long
 * table and index names. Collections with drafts, or with a long path, must pass
 * a short static `dbName`, e.g.
 * `pricingField({ name: 'pricing_override', dbName: 'course_price' })`.
 */
export const pricingField = ({
  name = 'pricing',
  label,
  dbName,
  description,
}: {
  name?: string
  label?: string
  dbName?: string
  description?: string
} = {}): NamedGroupField => ({
  name,
  ...(label ? { label } : {}),
  ...(description ? { admin: { description } } : {}),
  type: 'group',
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'min',
          type: 'number',
          min: 0,
          admin: {
            description: 'The price in EGP; with a maximum it reads as a range, e.g. 2,500–3,000.',
            width: '50%',
          },
        },
        {
          name: 'max',
          type: 'number',
          min: 0,
          // Payload's own number checks (min, max, required) first, then the range.
          validate: ((value, options) => {
            const base = number(value, options)
            return base === true
              ? notBelow(value, (options.siblingData as Record<string, unknown>).min, 'the minimum')
              : base
          }) satisfies NumberFieldSingleValidation,
          admin: { width: '50%', description: 'Leave empty for a single price.' },
        },
        {
          name: 'currency',
          type: 'select',
          defaultValue: 'EGP',
          options: [{ label: 'EGP', value: 'EGP' }],
          admin: { hidden: true },
        },
      ],
    },
    {
      name: 'note',
      type: 'text',
      localized: true,
      admin: {
        description:
          'Anything the price needs said, e.g. “Sliding scale: choose the tier that fits your budget.”',
      },
    },
    {
      name: 'need_based_deductions',
      type: 'checkbox',
      label: 'Need-based deductions available',
      admin: {
        description: 'Tick when people who can’t pay the full price may ask for a reduction.',
      },
    },
    {
      name: 'payment_plans',
      type: 'array',
      ...(dbName ? { dbName: `${dbName}_plans` } : {}),
      fields: [
        { name: 'label', type: 'text', localized: true, required: true },
        {
          name: 'installments',
          type: 'array',
          ...(dbName ? { dbName: `${dbName}_plan_items` } : {}),
          fields: [{ name: 'amount', type: 'number', min: 0, required: true }],
        },
      ],
      admin: { description: 'Ways to pay in instalments, e.g. “Three payments” of 10,000 each.' },
    },
  ],
})
