'use client'

import type { ComponentProps } from 'react'

import { track } from '@/lib/analytics/track'

/** The event page's Register link; counts the click (the event's slug only). */
export function RegisterLink({ slug, onClick, ...props }: ComponentProps<'a'> & { slug: string }) {
  return (
    <a
      {...props}
      onClick={(event) => {
        track('register_clicked', { kind: 'event', id: slug })
        onClick?.(event)
      }}
    />
  )
}
