import type { NamedGroupField } from 'payload'

import { notBelow } from './validators'

/**
 * What something costs, as a range in EGP with optional payment plans.
 * Cycles hold one per course type; a course can override with
 * `pricingField({ name: 'pricing_override' })`.
 */
export const pricingField = ({
  name = 'pricing',
  label,
}: { name?: string; label?: string } = {}): NamedGroupField => ({
  name,
  ...(label ? { label } : {}),
  type: 'group',
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'min', type: 'number', min: 0, admin: { width: '35%' } },
        {
          name: 'max',
          type: 'number',
          min: 0,
          validate: (value: unknown, { siblingData }: { siblingData: Record<string, unknown> }) =>
            notBelow(value, siblingData.min, 'the minimum'),
          admin: { width: '35%', description: 'Leave empty for a single price.' },
        },
        {
          name: 'currency',
          type: 'select',
          defaultValue: 'EGP',
          options: [{ label: 'EGP', value: 'EGP' }],
          admin: { width: '30%' },
        },
      ],
    },
    { name: 'note', type: 'text', localized: true },
    { name: 'need_based_deductions', type: 'checkbox', label: 'Need-based deductions available' },
    {
      name: 'payment_plans',
      type: 'array',
      fields: [
        { name: 'label', type: 'text', localized: true, required: true },
        {
          name: 'installments',
          type: 'array',
          fields: [
            {
              type: 'row',
              fields: [
                { name: 'amount', type: 'number', min: 0, required: true, admin: { width: '50%' } },
                {
                  name: 'due_date',
                  type: 'date',
                  admin: { width: '50%', date: { pickerAppearance: 'dayOnly' } },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
})
