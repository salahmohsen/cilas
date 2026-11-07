import { relId } from '@/lib/relation'
import type { CollectionBeforeValidateHook, CollectionConfig } from 'payload'

import { anyone, isAdmin } from '@/access'
import { COURSE_TYPE_OPTIONS } from '@/fields/course-type'
import { pricingField } from '@/fields/pricing'
import { registrationField } from '@/fields/registration'
import { academicYear, cycleTitle, SEASONS, type Season } from '@/lib/cycle'
import { slugify } from '@/lib/slugify'
import { importFields } from '@/fields/import'
import { revalidateAfterChange, revalidateAfterDelete } from '@/lib/revalidate'

/**
 * Title, slug and academic year are derived, never typed (ADR 0003). The
 * place in the title is the place's city, so it needs a lookup.
 */
export const deriveCycleIdentity: CollectionBeforeValidateHook = async ({
  data,
  originalDoc,
  req,
}) => {
  if (!data) return data
  const merged = { ...originalDoc, ...data }
  const season = merged.season as Season | undefined
  const start_year = merged.start_year as number | undefined
  if (!season || !start_year) return data

  const placeId = relId(merged.place) ?? undefined
  const place = placeId
    ? await req.payload
        .findByID({
          collection: 'places',
          id: placeId,
          depth: 0,
          // Title and slug are not localized: always name the place in the
          // default locale, whatever locale the editor is working in.
          locale: 'en', // the config's defaultLocale
          req,
        })
        .catch(() => null)
    : null

  const title = cycleTitle({ season, start_year, place: place?.city || place?.name })
  return {
    ...data,
    title,
    slug: slugify(title),
    academic_year: academicYear({ season, start_year, start_date: merged.start_date }),
  }
}

/** One intake of courses in a season, start year and place (CONTEXT.md). */
export const Cycles: CollectionConfig = {
  slug: 'cycles',
  access: {
    read: anyone,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'academic_year', 'start_date'],
  },
  defaultSort: '-start_date',
  // One intake per season, year and place (ADR 0003, ADR 0007).
  indexes: [{ fields: ['season', 'start_year', 'place'], unique: true }],
  hooks: {
    beforeValidate: [deriveCycleIdentity],
    afterChange: [revalidateAfterChange('cycles')],
    afterDelete: [revalidateAfterDelete('cycles')],
  },
  fields: [
    { name: 'title', type: 'text', admin: { readOnly: true } },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      index: true,
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'season',
          type: 'select',
          required: true,
          options: SEASONS.map((value) => ({
            label: value.charAt(0).toUpperCase() + value.slice(1),
            value,
          })),
          admin: { width: '33%' },
        },
        {
          name: 'start_year',
          type: 'number',
          required: true,
          min: 2012,
          max: 2100,
          admin: {
            description:
              'The year it starts in. A winter cycle counts by its January: Dec 2025–Feb 2026 is 2026.',
            width: '33%',
          },
        },
        {
          name: 'place',
          type: 'relationship',
          relationTo: 'places',
          required: true,
          admin: { width: '34%' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'start_date',
          type: 'date',
          admin: { width: '50%', date: { pickerAppearance: 'dayOnly' } },
        },
        {
          name: 'academic_year',
          type: 'text',
          index: true,
          admin: { width: '50%', readOnly: true },
        },
      ],
    },
    registrationField(),
    {
      name: 'pricing',
      type: 'array',
      admin: { description: 'One price per group of course types.' },
      fields: [
        {
          name: 'course_types',
          type: 'select',
          hasMany: true,
          required: true,
          options: [...COURSE_TYPE_OPTIONS],
          admin: { description: 'Which course types this price is for, e.g. Thematic and Lab.' },
        },
        pricingField({ dbName: 'cycle_price' }),
      ],
    },
    {
      name: 'courses',
      type: 'join',
      collection: 'courses',
      on: 'cycle',
      admin: { allowCreate: false, defaultColumns: ['title', 'course_type', 'fellows'] },
    },
    ...importFields(),
  ],
}
