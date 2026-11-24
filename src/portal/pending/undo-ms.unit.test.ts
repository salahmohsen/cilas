import { expect, it, vi } from 'vitest'
import { undoMsFromEnv } from './undo-ms'

it.each([
  [undefined, 5000],
  ['6000', 5000],
  ['499', 5000],
  ['1500.5', 5000],
  ['1500ms', 5000],
  ['500', 500],
  ['1500', 1500],
  ['5000', 5000],
])('undo window %s resolves to %s ms', (value, expected) => {
  vi.stubEnv('NEXT_PUBLIC_PORTAL_UNDO_MS', value)
  expect(undoMsFromEnv()).toBe(expected)
})
