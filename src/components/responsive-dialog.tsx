'use client'

import type { ReactNode } from 'react'

import { BottomSheet } from '@/components/arc/bottom-sheet/bottom-sheet'
import { Dialog, DialogContent, DialogTrigger } from '@/components/arc/dialog/dialog'
import { useNarrow } from '@/lib/use-narrow'

/** A dialog on wide screens and, on phones, a bottom sheet as tall as its content. */
export function ResponsiveDialog({
  trigger,
  open,
  onOpenChange,
  title,
  description,
  closeLabel,
  className,
  onCloseAutoFocus,
  children,
}: {
  /** The button that opens it, when `open` is not controlled by the caller. */
  trigger?: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  title: string
  description?: string
  closeLabel?: string
  /** For the dialog only; the sheet has its own width. */
  className?: string
  onCloseAutoFocus?: (event: Event) => void
  children: ReactNode
}) {
  const narrow = useNarrow()
  if (narrow)
    return (
      <BottomSheet
        closeLabel={closeLabel}
        description={description}
        detents={[0.85]}
        fit
        onCloseAutoFocus={onCloseAutoFocus}
        onOpenChange={onOpenChange}
        open={open}
        title={title}
        trigger={trigger}
      >
        {children}
      </BottomSheet>
    )
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent
        className={className}
        closeLabel={closeLabel}
        description={description}
        onCloseAutoFocus={onCloseAutoFocus}
        title={title}
      >
        {children}
      </DialogContent>
    </Dialog>
  )
}
