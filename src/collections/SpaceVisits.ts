import type { PostgresAdapterArgs } from '@payloadcms/db-postgres'
import type { CollectionConfig } from 'payload'

import { nobody, ownAccountRows, signedInOwnAccountRows } from '@/access'

const visitOwners = [
  { name: 'account', relationTo: 'users' },
  { name: 'space', relationTo: 'spaces' },
] as const

/** A last visit and its checklist belong to both the account and the space. */
export const cascadeSpaceVisits: NonNullable<PostgresAdapterArgs['beforeSchemaInit']>[number] = ({
  adapter,
  schema,
}) => {
  const columns = adapter.rawTables.space_visits.columns
  for (const { name } of visitOwners) {
    const reference = columns[name]?.reference
    if (!reference) throw new Error(`Missing space_visits foreign key for ${name}`)
    reference.onDelete = 'cascade'
  }
  return schema
}

/**
 * Per account and space (spec §2 first steps, spec's "new posts since the
 * last visit"): what the member has done here and when they last looked.
 * Also the whole checklist's mark storage; nothing here gates reading.
 */
export const SpaceVisits: CollectionConfig = {
  slug: 'space-visits',
  labels: { singular: 'Visit', plural: 'Visits' },
  // Anyone signed-in may read and write only their own rows; the collection
  // never leaves members' hands, so a flat id-own rule is enough.
  access: {
    read: ownAccountRows,
    // A Where is ignored on create, so REST could write rows for any account;
    // spaces-write creates them with overrideAccess.
    create: nobody,
    update: signedInOwnAccountRows,
    delete: nobody, // rows hold a timestamp and checklist marks, no content: the 30-day purge leaves them
  },
  admin: { hidden: true },
  fields: [
    ...visitOwners.map((owner) => ({
      ...owner,
      type: 'relationship' as const,
      required: true,
      index: true,
      access: { update: nobody },
    })),
    { name: 'last_visited_at', type: 'date', required: true },
    { name: 'saw_privacy', type: 'checkbox', defaultValue: false },
    { name: 'introduced', type: 'checkbox', defaultValue: false },
    { name: 'read_pinned', type: 'checkbox', defaultValue: false },
    { name: 'checked_profile', type: 'checkbox', defaultValue: false },
    { name: 'chose_digest', type: 'checkbox', defaultValue: false },
  ],
  indexes: [{ fields: ['account', 'space'], unique: true }],
}
