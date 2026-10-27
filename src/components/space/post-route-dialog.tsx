'use client'

import type { ReactNode } from 'react'
import { usePathname, useRouter, useSearchParams, useSelectedLayoutSegments } from 'next/navigation'
import { useTranslations } from 'next-intl'

import { Dialog, DialogContent } from '@/components/arc/dialog/dialog'
import { TextShimmer } from '@/components/arc/text-shimmer/text-shimmer'
import styles from './space.module.css'

/** This shell stays mounted when the route's loading state becomes the post. */
export function PostRouteDialog({ children }: { children: ReactNode }) {
  const t = useTranslations('SpacePost')
  const router = useRouter()
  const pathname = usePathname()
  const segments = useSelectedLayoutSegments()
  const photos = useSearchParams().has('photo')
  const open = segments.at(-2) === 'posts'

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) router.back()
      }}
    >
      <DialogContent
        title={t('dialogTitle')}
        closeLabel={t('dialogClose')}
        bare
        className={photos ? styles.postDialogWide : styles.postDialog}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          // No Radix trigger: the opener is a feed link, kept mounted by the parallel route.
          document
            .querySelector<HTMLAnchorElement>(`a[href="${pathname}"]`)
            ?.focus({ preventScroll: true })
        }}
      >
        {children}
      </DialogContent>
    </Dialog>
  )
}

export function PostDialogLoading() {
  const t = useTranslations('SpacePost')
  return (
    <div className={styles.dialogStatus} role="status">
      <TextShimmer as="p" className={styles.meta}>
        {t('dialogLoading')}
      </TextShimmer>
    </div>
  )
}
