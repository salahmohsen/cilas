'use client'

import type { ReactNode } from 'react'

import { ResponsiveDialog } from '@/components/responsive-dialog'

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
    <ResponsiveDialog
      closeLabel={closeLabel}
      title={title}
      trigger={
        <button className={className} type="button">
          {label}
        </button>
      }
    >
      {children}
    </ResponsiveDialog>
  )
}
