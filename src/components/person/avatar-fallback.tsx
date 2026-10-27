import BoringAvatar from 'boring-avatars'
import type { SVGProps } from 'react'

type Props = Omit<SVGProps<SVGSVGElement>, 'name'> & { seed: string }

/** A local Beam portrait, stable across names, locales, and surfaces. */
export function AvatarFallback({ seed, ...props }: Props) {
  return (
    <BoringAvatar
      name={seed.trim() || 'anonymous'}
      variant="beam"
      size="100%"
      square
      preserveAspectRatio="xMidYMid slice"
      {...props}
    />
  )
}
