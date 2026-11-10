import type { NamedGroupField, ArrayField } from 'payload'
import { array } from 'payload/shared'
import { validateContributionOptions } from '@/lib/pricing'

/**
 * Suggested contributions in EGP. Payment plans are enabled only for programmes.
 * Cycles hold one per course type; a course can override with
 * `contributionField({ name: 'pricing_override' })`.
 *
 * Postgres cuts identifiers at 63 characters, and the nested arrays build long
 * table and index names. Collections with drafts, or with a long path, must pass
 * a short static `dbName`, e.g.
 * `contributionField({ name: 'pricing_override', dbName: 'course_price' })`.
 */
export const contributionField = ({
  name = 'pricing',
  label,
  dbName,
  description,
  paymentPlans = false,
}: {
  name?: string
  label?: string
  dbName?: string
  description?: string
  paymentPlans?: boolean
} = {}): NamedGroupField => ({
  name,
  label: label ?? 'Contribution',
  ...(description ? { admin: { description } } : {}),
  type: 'group',
  fields: [
    {
      name: 'options',
      type: 'array',
      ...(dbName ? { dbName: `${dbName}_options` } : {}),
      validate: async (value, options) => {
        const base = await array(value, options)
        return base === true ? validateContributionOptions(value) : base
      },
      fields: [
        { name: 'amount', type: 'number', min: 0, required: true },
        { name: 'default', type: 'checkbox', defaultValue: false },
      ],
    },
    {
      name: 'currency',
      type: 'select',
      defaultValue: 'EGP',
      options: [{ label: 'EGP', value: 'EGP' }],
      admin: { hidden: true },
    },
    { name: 'note', type: 'text', localized: true },
    {
      name: 'need_based_deductions',
      type: 'checkbox',
      label: 'Need-based deductions available',
    },
    ...(paymentPlans
      ? [
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
            admin: {
              description: 'Ways to pay in instalments, e.g. “Three payments” of 10,000 each.',
            },
          } satisfies ArrayField,
        ]
      : []),
  ],
})
