import type { Payload, TypedUser } from 'payload'

import { personOf } from '@/access'
import { mediaPopulate, mediaThumbnail } from '@/lib/media-image'

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase() || '?'

/**
 * The account's photo in the admin's user block (`admin.avatar`). The photo
 * lives on the linked person, one relationship away, which payload-theme's
 * `avatar: { field }` cannot follow. The theme drops its accent circle for
 * any custom node, so the no-photo case draws the initials circle itself.
 */
export async function AdminAvatar({ payload, user }: { payload: Payload; user?: TypedUser }) {
  const personId = user ? personOf(user) : null
  const person =
    personId === null
      ? null
      : await payload
          .findByID({
            collection: 'people',
            id: personId,
            select: { name: true, photo: true },
            // The storage hook builds `url` from `filename` and `prefix`.
            populate: { media: { ...mediaPopulate, sizes: true } },
            depth: 1,
            disableErrors: true,
            overrideAccess: true,
          })
          .catch(() => null)
  const photo = typeof person?.photo === 'object' ? mediaThumbnail(person.photo) : undefined
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element -- an R2 URL in Payload's admin
    return <img src={photo} alt="" />
  }
  const email = typeof user?.email === 'string' ? user.email : ''
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 999,
        background: 'var(--pt-accent)',
        color: 'var(--pt-accent-contrast)',
      }}
    >
      {initialsOf(person?.name || email.split('@')[0] || '')}
    </span>
  )
}
