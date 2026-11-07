import BoringAvatar from 'boring-avatars'
import type { SVGProps } from 'react'

import { POSTER_COLORS } from './poster-colors'

type Props = Omit<SVGProps<SVGSVGElement>, 'name'> & { seed: string }

/** A local Beam portrait, stable across names, locales, and surfaces. */
export function AvatarFallback({ seed, ...props }: Props) {
  return (
    <BoringAvatar
      name={seed.trim() || 'anonymous'}
      variant="beam"
      colors={POSTER_COLORS}
      size="100%"
      square
      preserveAspectRatio="xMidYMid slice"
      {...props}
    />
  )
}
