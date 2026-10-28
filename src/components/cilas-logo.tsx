import type { SVGProps } from 'react'

import { LOGO, LOGO_VIEWBOX } from '@/components/home/home-scene-logo'

export function CilasLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="currentColor"
      fillRule="evenodd"
      focusable="false"
      viewBox={LOGO_VIEWBOX}
      {...props}
    >
      {LOGO.map((shape) => (
        <path d={shape.d} key={shape.d} />
      ))}
    </svg>
  )
}
