import { payloadEditable, type PayloadEditableOptions } from '@payload-inline-visual-editor/react'

type Attrs = Record<string, string>

/**
 * The visual editor's `data-pve-*` attributes, only where `on` (the admin's
 * live preview): the public page carries none. Paths are the document's data
 * paths, e.g. `sessions.2.session_title`.
 */
export const editableIn = (on: boolean) => {
  const field = (path: string, options?: PayloadEditableOptions): Attrs =>
    on ? payloadEditable(path, options) : {}
  return Object.assign(field, {
    container: (path: string): Attrs => (on ? payloadEditable.container(path) : {}),
    scope: (scope: Parameters<typeof payloadEditable.scope>[0]): Attrs =>
      on ? payloadEditable.scope(scope) : {},
  })
}

export type Editable = ReturnType<typeof editableIn>
