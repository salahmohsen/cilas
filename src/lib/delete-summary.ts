/**
 * What a delete takes with it, shown in the admin delete dialog
 * (src/components/admin/delete-dialog.tsx) before it runs. Built by each
 * collection's summary (src/forms/delete-endpoints.ts).
 */
export type DeleteGroup = {
  /** Plural noun for what is in the group, such as "enrollments". */
  label: string
  count: number
  /** Names of the first few, so the admin can see who or what is affected. */
  items: string[]
}

export type DeleteSummary = {
  /** The document's title; the dialog asks for it before the delete runs. */
  name: string
  /** What the dialog deletes, such as "course". */
  noun: string
  /** Why this document may not be deleted, when it may not. */
  blocked?: string
  /** What is deleted with the document. */
  deletes: DeleteGroup[]
  /** What stays, but loses its link to the document. */
  unlinks: DeleteGroup[]
}

/** How many names a group lists before "and N more". */
export const LISTED = 8

export const group = (label: string, count: number, items: string[]): DeleteGroup => ({
  label,
  count,
  items: items.slice(0, LISTED),
})

/** Groups with nothing in them do not show. */
export const nonEmpty = (groups: DeleteGroup[]): DeleteGroup[] => groups.filter((g) => g.count > 0)
