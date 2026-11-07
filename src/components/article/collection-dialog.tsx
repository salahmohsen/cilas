'use client'

import { ArrowUpRight, X } from 'lucide-react'
import type { ComponentProps } from 'react'

import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/arc/dialog/dialog'
import { CollectionCard } from '@/components/article/collection-card'

/**
 * The side card's row for the article's collection: its name and count. It
 * opens the collection card in a dialog; the card is the dialog's only
 * surface and closes from a box at the end of its strip.
 */
export function CollectionDialog({
  closeLabel,
  ...card
}: Omit<ComponentProps<typeof CollectionCard>, 'close'> & { closeLabel: string }) {
  return (
    <Dialog>
      <DialogTrigger className="side-card-collection" type="button">
        <span className="side-card-collection-text">
          <span className="side-card-name" dir="auto">
            {card.title}
          </span>
          <span className="side-card-role">{card.labels.count}</span>
        </span>
        <ArrowUpRight aria-hidden size={16} />
      </DialogTrigger>
      <DialogContent chrome={false} className="collection-dialog" title={card.title}>
        <CollectionCard
          {...card}
          close={
            <DialogClose aria-label={closeLabel} className="collection-card-close">
              <X aria-hidden size={18} strokeWidth={1.75} />
            </DialogClose>
          }
        />
      </DialogContent>
    </Dialog>
  )
}
