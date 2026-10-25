'use client'

import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Dialog, DialogContent } from '@/components/arc/dialog/dialog'
import { ExpandableText } from '@/components/arc/expandable-text/expandable-text'

const LINES = 6

/** The About text stays six lines tall; the full text opens in a dialog so a long one never pushes the rail. */
export function AboutClamp({ text, children }: { text: string; children: ReactNode }) {
  const t = useTranslations('Spaces')
  const tp = useTranslations('SpacePost')
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  // Arc's text starts folded until it measures, so short text skips it rather than flash a "Read more".
  if (text.length <= LINES * 40 && text.split('\n').length <= LINES) return children
  return (
    <div ref={root}>
      <ExpandableText lines={LINES} moreLabel={tp('readMore')} onMore={() => setOpen(true)}>
        {children}
      </ExpandableText>
      <Dialog open={open} onOpenChange={setOpen}>
        {/* The button is not a Radix trigger, so focus would fall to the body on close. */}
        <DialogContent
          title={t('aboutSpace')}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            root.current?.querySelector('button')?.focus()
          }}
        >
          {children}
        </DialogContent>
      </Dialog>
    </div>
  )
}
