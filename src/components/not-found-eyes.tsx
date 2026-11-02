'use client'

import { useReducedMotion } from 'motion/react'

import { EyeTracking } from '@/components/ui/eye-tracking'

/**
 * The 404 page's eyes. They follow the pointer; with reduced motion they
 * still follow it but do not blink or drift on their own.
 */
export function NotFoundEyes() {
  const reduce = useReducedMotion()
  return (
    <div aria-hidden="true">
      <EyeTracking
        eyeSize={112}
        gap={32}
        blinkInterval={reduce ? 0 : 4000}
        idleAnimation={!reduce}
      />
    </div>
  )
}
