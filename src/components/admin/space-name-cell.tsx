import { DefaultCell } from '@payloadcms/ui'
import type { DefaultServerCellComponentProps, Payload } from 'payload'
import { cache } from 'react'

import { relId } from '@/lib/relation'

/** One read per space per render, however many rows name it. */
const spaceName = cache(async (payload: Payload, id: number): Promise<string> => {
  const space = await payload
    .findByID({ collection: 'spaces', id, depth: 0, overrideAccess: true })
    .catch(() => null)
  const name = (space as { display_name?: unknown } | null)?.display_name
  return typeof name === 'string' && name ? name : `Space ${id}`
})

/**
 * A list's "Space" column: the space's name (its virtual display_name,
 * src/lib/space-display-name.ts) in place of its ID. Payload shows a related
 * document by its `useAsTitle`, and a virtual field cannot be one. The stock
 * cell draws the text, so the column keeps the row's link when it is the
 * first column.
 */
export async function SpaceNameCell({
  cellData,
  collectionSlug,
  link,
  linkURL,
  payload,
  rowData,
  viewType,
}: DefaultServerCellComponentProps) {
  const id = relId(cellData as never)
  const name = id == null ? '' : await spaceName(payload, id)
  return (
    <DefaultCell
      cellData={name}
      collectionSlug={collectionSlug}
      field={{ name: 'space', type: 'text' } as never}
      link={link}
      linkURL={linkURL}
      rowData={{ id: rowData.id }}
      viewType={viewType}
    />
  )
}
