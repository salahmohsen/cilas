'use client'

import { ArrowUpRight, X } from 'lucide-react'
import type { ComponentProps } from 'react'

import { BottomSheet, BottomSheetClose } from '@/components/arc/bottom-sheet/bottom-sheet'
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/arc/dialog/dialog'
import { CollectionCard } from '@/components/article/collection-card'
import { useNarrow } from '@/lib/use-narrow'

/**
 * The side card's row for the article's collection: its name and count. It
 * opens the collection card, in a dialog or, on phones, a bottom sheet; the
 * card is the only surface and closes from a box at the end of its strip.
 */
export function CollectionDialog({
  closeLabel,
  ...card
}: Omit<ComponentProps<typeof CollectionCard>, 'close'> & { closeLabel: string }) {
  const narrow = useNarrow()
  const row = (
    <>
      <span className="side-card-collection-text">
        <span className="side-card-name" dir="auto">
          {card.title}
        </span>
        <span className="side-card-role">{card.labels.count}</span>
      </span>
      <ArrowUpRight aria-hidden size={16} />
    </>
  )
  const closeIcon = <X aria-hidden size={18} strokeWidth={1.75} />

  if (narrow)
    return (
      <BottomSheet
        bare
        className="collection-sheet"
        closeLabel={closeLabel}
        detents={[0.85]}
        title={card.title}
        trigger={
          <button className="side-card-collection" type="button">
            {row}
          </button>
        }
      >
        <CollectionCard
          {...card}
          close={
            <BottomSheetClose aria-label={closeLabel} className="collection-card-close">
              {closeIcon}
            </BottomSheetClose>
          }
        />
      </BottomSheet>
    )

  return (
    <Dialog>
      <DialogTrigger className="side-card-collection" type="button">
        {row}
      </DialogTrigger>
      <DialogContent chrome={false} className="collection-dialog" title={card.title}>
        <CollectionCard
          {...card}
          close={
            <DialogClose aria-label={closeLabel} className="collection-card-close">
              {closeIcon}
            </DialogClose>
          }
        />
      </DialogContent>
    </Dialog>
  )
}
