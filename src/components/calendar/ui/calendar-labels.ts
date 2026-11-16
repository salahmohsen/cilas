import type { useTranslations } from 'next-intl'

import type { CalendarView, ViewSpan } from './calendar-views'

/** The words of a block's menu. A host that gives none gets no menu. */
export type CalendarMenuLabels = {
  /** The menu's name: "Actions for Week 3". */
  name: (title: string) => string
  open: string
  /** Adds a block to the same item, at the same time on the next day. */
  addNextDay: string
  /** Makes a new item with all the blocks of this one, a week later. */
  copyNextWeek: string
  deleteBlock: string
  /** What screen readers hear after the first two, since the new block may be in another week. */
  addedNextDay: (day: string) => string
  copiedNextWeek: (day: string) => string
}

/**
 * Every word the calendar shows. The host supplies them: the site from
 * `messages/*.json` through `calendarLabelsFrom`. The component holds no copy of its own.
 */
export type CalendarLabels = {
  /** Names the whole calendar for screen readers. */
  name: string
  cairoTime: string
  today: string
  /** Moves back or forward by what the view shows: "Previous week", "Next day". `count` is its days or weeks. */
  previous: (span: ViewSpan, count: number) => string
  next: (span: ViewSpan, count: number) => string
  /** Names the view switch. */
  view: string
  /** A view's name in the switch: "Week", "3 days". `count` is the days it shows. */
  viewName: (view: CalendarView, count: number) => string
  /** What an agenda with nothing in it says: "Nothing scheduled this week". */
  nothing: (span: ViewSpan, count: number) => string
  allDay: string
  legend: string
  /** The toggle of the side panel: Up next, the colour key, Unscheduled. */
  panel: string
  upNext: string
  /** The toolbar's button that adds a new item, in edit mode. Without it there is none. */
  create?: string
  cancelled: string
  /** What a marked item is, on its face, in its name and in the legend. */
  changed: string
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
  /** A line in the save bar while changes wait, such as which other Save does not save them. */
  saveNote?: string
  saveFailed: string
  /** Said when newly loaded items replace an item that has unsaved changes: they are gone. */
  dropped: (titles: string) => string
  dismiss: string
  /** The "+" on a day's header. */
  addBlock: (day: string) => string
  /** The menu that puts an unscheduled item on a day, the keyboard's way to place it. */
  placeOnDay: string
  /** The block menu: right-click, the "⋯" on a block, Shift+F10 or the Menu key. */
  menu?: CalendarMenuLabels
  /** What screen readers hear after an edit. */
  announce: (type: 'draw' | 'move' | 'resize' | 'delete' | 'cancel', label: string) => string
}

/** The words only the host knows: what its kinds are called, and what a new item is. */
export type CalendarHostLabels = {
  kind: CalendarLabels['kind']
  newItem: string
  /** What the toolbar's add button says: "New session". */
  create?: string
  /** What the Save button says, when "Save" would be unclear beside another Save on the page. */
  save?: string
  /** What the save bar says while changes wait, beside another Save on the page. */
  saveNote?: string
  /** What the block menu's actions are called. Without it the calendar has no block menu. */
  menu?: Pick<
    CalendarMenuLabels,
    'addNextDay' | 'copyNextWeek' | 'deleteBlock' | 'addedNextDay' | 'copiedNextWeek'
  >
}

/** The `CalendarUi` namespace of `messages/*.json`, from `useTranslations` or `createTranslator`. */
export type CalendarTranslator = ReturnType<typeof useTranslations<'CalendarUi'>>

/** Every label, from the shared translations. The site and the admin both build theirs here. */
export const calendarLabelsFrom = (
  t: CalendarTranslator,
  { kind, newItem, create, menu, save, saveNote }: CalendarHostLabels,
): CalendarLabels => ({
  name: t('name'),
  cairoTime: t('cairoTime'),
  today: t('today'),
  previous: (span, count) => t('previous', { span, count }),
  next: (span, count) => t('next', { span, count }),
  view: t('view'),
  viewName: (view, count) => t('viewName', { view, count }),
  nothing: (span, count) => t('nothing', { span, count }),
  allDay: t('allDay'),
  legend: t('legend'),
  panel: t('panel'),
  upNext: t('upNext'),
  create,
  cancelled: t('cancelled'),
  changed: t('changed'),
  unscheduled: t('unscheduled'),
  kind,
  range: (from, to) => t('range', { from, to }),
  timeRange: (start, end) => t('timeRange', { start, end }),
  blockName: ({ title, day, time, status }) =>
    t('blockName', { title, day, time, status, hasStatus: String(status !== '') }),
  newItem,
  unsaved: t('unsaved'),
  deleted: t('deleted'),
  restore: t('restore'),
  restoreName: ({ title, day, time }) => t('restoreName', { title, day, time }),
  save: save ?? t('save'),
  saving: t('saving'),
  cancelEdits: t('cancelEdits'),
  changes: (count) => t('changes', { count }),
  saveNote,
  saveFailed: t('saveFailed'),
  dropped: (titles) => t('dropped', { titles }),
  dismiss: t('dismiss'),
  addBlock: (day) => t('addBlock', { day }),
  placeOnDay: t('placeOnDay'),
  menu: menu && {
    ...menu,
    name: (title) => t('menuName', { title }),
    open: t('menuOpen'),
  },
  announce: (type, label) => t('announce', { type, label }),
})
