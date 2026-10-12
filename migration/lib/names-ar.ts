import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { Payload } from 'payload'

const isArabic = (s?: string | null): boolean => Boolean(s && /\p{Script=Arabic}/u.test(s))

/**
 * Gives every person an Arabic name: the one in migration/names-ar.json
 * (the archive's own spelling where it gives one, else a transliteration
 * for an editor to check), or, when the name is already Arabic, the name
 * itself. Only fills an Arabic name that is missing or in Latin letters,
 * and never touches a reviewed person. Returns how many were named.
 */
export const applyArabicNames = async (payload: Payload): Promise<number> => {
  const names = JSON.parse(
    readFileSync(path.join(import.meta.dirname, '..', 'names-ar.json'), 'utf8'),
  ) as Record<string, string>
  const { docs } = await payload.find({
    collection: 'people',
    pagination: false,
    depth: 0,
    locale: 'all',
    overrideAccess: true,
    select: { name: true, import_status: true },
  })
  let named = 0
  for (const doc of docs) {
    const d = doc as unknown as { id: number; name?: Record<string, string>; import_status?: string | null }
    if (d.import_status === 'reviewed' || isArabic(d.name?.ar)) continue
    const en = d.name?.en ?? ''
    const ar = names[en] ?? (isArabic(en) ? en : undefined)
    if (!ar) continue
    await payload.update({ collection: 'people', id: d.id, data: { name: ar }, locale: 'ar', overrideAccess: true })
    named++
  }
  return named
}
