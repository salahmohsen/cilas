import { Globe } from 'lucide-react'
import { siFacebook, siInstagram, siX, siYoutube } from 'simple-icons'

import type { PersonLink } from '@/lib/space-members'

// simple-icons dropped LinkedIn; retain the mark already used in person hover cards.
const LINKEDIN =
  'M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z'

const BRAND: Record<Exclude<PersonLink['kind'], 'website'>, string> = {
  facebook: siFacebook.path,
  instagram: siInstagram.path,
  x: siX.path,
  youtube: siYoutube.path,
  linkedin: LINKEDIN,
}

export const SOCIAL_LABELS: Record<PersonLink['kind'], string> = {
  website: 'Website',
  facebook: 'Facebook',
  instagram: 'Instagram',
  x: 'X',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
}

export function SocialIcon({ kind, size = 20 }: { kind: PersonLink['kind']; size?: number }) {
  return kind === 'website' ? (
    <Globe size={size} aria-hidden="true" />
  ) : (
    <svg aria-hidden="true" fill="currentColor" width={size} height={size} viewBox="0 0 24 24">
      <path d={BRAND[kind]} />
    </svg>
  )
}
