import BoringAvatar from 'boring-avatars'
import type { SVGProps } from 'react'

/** The site's poster colors (src/lib/poster-colors.ts), kept here so Arc imports no app code. */
const AVATAR_COLORS = ['#ffb71b', '#1782ea', '#ff7d9d', '#12d08f']

type Props = Omit<SVGProps<SVGSVGElement>, 'name'> & { seed: string }

/** A local Beam portrait, stable across names, locales, and surfaces. */
export function AvatarFallback({ seed, ...props }: Props) {
  return (
    <BoringAvatar
      name={seed.trim() || 'anonymous'}
      variant="beam"
      colors={AVATAR_COLORS}
      size="100%"
      square
      preserveAspectRatio="xMidYMid slice"
      {...props}
    />
  )
}
