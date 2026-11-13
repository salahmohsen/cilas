/**
 * Every word the calendar shows. The host supplies them: the site from
 * `messages/*.json` through `useCalendarLabels`, the admin from its own
 * translations. The component holds no copy of its own.
 */
export type CalendarLabels = {
  /** Names the whole calendar for screen readers. */
  name: string
  cairoTime: string
  today: string
  previousWeek: string
  nextWeek: string
  daySwitcher: string
  allDay: string
  legend: string
  timeFormat: string
  hours24: string
  hours12: string
  cancelled: string
  unscheduled: string
  /** What the legend calls an item kind. */
  kind: (kind: string) => string
  /** "14 Nov to 20 Nov 2026" */
  range: (from: string, to: string) => string
  /** "19:00 to 21:00" */
  timeRange: (start: string, end: string) => string
  /** A block's spoken name. `status` is "" or what it is now: "Cancelled and unsaved". */
  blockName: (parts: { title: string; day: string; time: string; status: string }) => string

  /** The title of an item drawn on an empty slot, until the host names it. */
  newItem: string
  unsaved: string
  deleted: string
  /** The word on a ghost. */
  restore: string
  /** A ghost's spoken name, which starts with `restore`. */
  restoreName: (parts: { title: string; day: string; time: string }) => string
  save: string
  saving: string
  cancelEdits: string
  changes: (count: number) => string
  saveFailed: string
  /** How to draw, move, resize and delete, with the mouse and the keyboard. */
  editHint: string
  /** The "+" on a day's header. */
  addBlock: (day: string) => string
  /** The menu that puts an unscheduled item on a day, the keyboard's way to place it. */
  placeOnDay: string
  /** What screen readers hear after an edit. */
  announce: (type: 'draw' | 'move' | 'resize' | 'delete' | 'cancel', label: string) => string
}
