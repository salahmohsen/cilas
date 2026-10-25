import { Paperclip } from 'lucide-react'

import type { SpaceFileRef } from '@/lib/spaces-data'

import { PhotoGrid } from './photo-grid'
import styles from './space.module.css'

/** A private file on a post or comment, as a chip that downloads it. */
export function FileChip({ file }: { file: SpaceFileRef }) {
  return (
    <a href={file.url} className={styles.fileChip} download={file.name}>
      <Paperclip size={14} aria-hidden="true" />
      <bdi>{file.name}</bdi>
      <span className={styles.meta}>{Math.max(1, Math.round(file.size / 1024))} KB</span>
    </a>
  )
}

/** A post's or a comment's files: the images as a photo grid, every other file as a chip. */
export function Attachments({
  files,
  label,
  compact = false,
  opensPost = false,
}: {
  files: SpaceFileRef[]
  label: string
  compact?: boolean
  /** A post's own files: a photo opens the post dialog at that photo */
  opensPost?: boolean
}) {
  const photos = files.filter((f) => f.isImage)
  const others = files.filter((f) => !f.isImage)
  return (
    <div className={styles.attachments}>
      {photos.length > 0 && <PhotoGrid photos={photos} compact={compact} opensPost={opensPost} />}
      {others.length > 0 && (
        <div className={styles.files} aria-label={label} role="group">
          {others.map((f) => (
            <FileChip key={f.id} file={f} />
          ))}
        </div>
      )}
    </div>
  )
}
