import type { ReactNode } from 'react'

import { ScrollArea } from '@/components/arc/scroll-area/scroll-area'

export function ArticleActionRow({
  children,
  flush,
  label,
}: {
  children: ReactNode
  flush?: boolean
  label: string
}) {
  return (
    <ScrollArea
      fade={0}
      label={label}
      orientation="horizontal"
      viewportClassName={flush ? 'side-card-action-row' : undefined}
    >
      {children}
    </ScrollArea>
  )
}
