/**
 * A save the host refused, with one way out: a button that drops every
 * unsaved change and then runs `then`, such as a reload of the current
 * items. Rejecting `onSave` with a plain Error shows only its message.
 */
export class CalendarSaveRefusal extends Error {
  constructor(
    message: string,
    readonly discard: { label: string; then: () => void },
  ) {
    super(message)
  }
}
