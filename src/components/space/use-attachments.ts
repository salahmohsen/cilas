'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'

import { prepareFiles } from '@/lib/image-downscale'
import { UPLOAD_TOTAL_MAX } from '@/lib/space-file-limits'

const MB = 1024 * 1024
const total = (files: File[]) => files.reduce((sum, f) => sum + f.size, 0)

/**
 * The files picked for one post or comment. Big photos are shrunk as they are
 * added; a pick that would take the total over what one send may carry is
 * refused with a message, so the member never loses text to a failed upload.
 */
export function useAttachments(max: number, onProblem: (message: string | null) => void) {
  const t = useTranslations('SpacePhotos')
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const latest = useRef<File[]>([])

  const tooLarge = (size: number) =>
    t('tooLarge', { size: Math.ceil(size / MB), max: UPLOAD_TOTAL_MAX / MB })

  const replace = (next: File[]) => {
    latest.current = next
    setFiles(next)
  }

  return {
    files,
    busy,
    add: async (picked: File[]) => {
      setBusy(true)
      const prepared = await prepareFiles(picked.slice(0, max))
      setBusy(false)
      const next = [...latest.current, ...prepared].slice(0, max)
      if (total(next) > UPLOAD_TOTAL_MAX) return onProblem(tooLarge(total(next)))
      onProblem(null)
      replace(next)
    },
    remove: (file: File) => {
      onProblem(null)
      replace(latest.current.filter((f) => f !== file))
    },
    clear: () => replace([]),
    /** The message to show when these files are too big to send, else null. */
    problem: () =>
      total(latest.current) > UPLOAD_TOTAL_MAX ? tooLarge(total(latest.current)) : null,
  }
}
