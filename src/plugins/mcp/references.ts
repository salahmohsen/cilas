import type { CollectionSlug } from 'payload'

import { env } from '@/env'

import { ToolInputError } from './errors'
import type { ToolContext } from './types'

/**
 * Fails with a message the AI can act on when an id it was given does not
 * exist. Drafts skip relationship validation, so a wrong id would otherwise
 * surface as a database error.
 */
export const assertExist = async (
  { payload, req, user }: ToolContext,
  collection: CollectionSlug,
  ids: number[],
  label: string,
): Promise<void> => {
  const unique = [...new Set(ids)]
  if (!unique.length) return
  const { docs } = await payload.find({
    collection,
    where: { id: { in: unique } },
    limit: unique.length,
    depth: 0,
    select: { updatedAt: true },
    draft: true,
    overrideAccess: false,
    user,
    req,
  })
  const found = new Set(docs.map((doc) => Number(doc.id)))
  const missing = unique.filter((id) => !found.has(id))
  if (missing.length) {
    throw new ToolInputError(
      `${label} ${missing.join(', ')} not found. Use the lookup tool to find the right id; do not guess ids.`,
    )
  }
}

/** The full address of a record in the admin, so the person can click it. */
export const adminUrl = (collection: string, id: number): string =>
  `${env.NEXT_PUBLIC_SERVER_URL.replace(/\/+$/, '')}/admin/collections/${collection}/${id}`
