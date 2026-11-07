import { payloadEditable, type PayloadEditableOptions } from '@payload-inline-visual-editor/react'

type Attrs = Record<string, string>

export const editableIn = (on: boolean) => {
  const field = (path: string, options?: PayloadEditableOptions): Attrs =>
    on ? payloadEditable(path, options) : {}
  return Object.assign(field, {
    /** Whether the marks are on: empty sections still render, to be added to. */
    on,
    container: (path: string): Attrs => (on ? payloadEditable.container(path) : {}),
    scope: (scope: Parameters<typeof payloadEditable.scope>[0]): Attrs =>
      on ? payloadEditable.scope(scope) : {},
  })
}

export type Editable = ReturnType<typeof editableIn>
