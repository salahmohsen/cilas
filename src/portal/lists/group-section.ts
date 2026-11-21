import type { GroupId } from './groups'

/** The attribute that marks a group's section. The server body writes it; `NewRowsFocus` finds it. */
export const groupSectionProps = (id: GroupId): { 'data-list-group': GroupId } => ({
  'data-list-group': id,
})

/** The section of a group under `root`, or null when the group shows no row. */
export const findGroupSection = (root: ParentNode, id: GroupId): HTMLElement | null =>
  root.querySelector<HTMLElement>(`[data-list-group="${id}"]`)
