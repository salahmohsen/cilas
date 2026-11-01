'use client'

import type { ReactNode } from 'react'

import { Dialog, DialogContent, DialogTrigger } from '@/components/arc/dialog/dialog'

/** The movie's full metadata, opened from the card's foot. */
export function MovieDetailsDialog({
  label,
  title,
  closeLabel,
  className,
  children,
}: {
  label: string
  title: string
  closeLabel: string
  className?: string
  children: ReactNode
}) {
  return (
    <Dialog>
      <DialogTrigger className={className} type="button">
        {label}
      </DialogTrigger>
      <DialogContent closeLabel={closeLabel} title={title}>
        {children}
      </DialogContent>
    </Dialog>
  )
}
