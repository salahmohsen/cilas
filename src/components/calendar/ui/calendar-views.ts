import { addDays, addMonths, monthOf, weekOf, weekStartOf } from './calendar-time'

/** How many days a view shows and how far previous and next move it. */
export type ViewSpan = 'day' | 'threeDays' | 'week' | 'twoWeeks' | 'month'

export type CalendarView = 'month' | 'week' | 'threeDays' | 'day' | 'agenda'

/** `grid` lays the hours down the days; `month` the days in weeks; `list` the agenda. */
type ViewRow = { id: CalendarView; span: ViewSpan; layout: 'grid' | 'month' | 'list' }

/**
 * The views the switch offers, in order, on a wide calendar and on a narrow
 * one. A new view is one more row; nothing else names the views one by one.
 */
const VIEWS: Record<'wide' | 'narrow', ViewRow[]> = {
  wide: [
    { id: 'month', span: 'month', layout: 'month' },
    { id: 'week', span: 'week', layout: 'grid' },
    { id: 'day', span: 'day', layout: 'grid' },
    { id: 'agenda', span: 'week', layout: 'list' },
  ],
  narrow: [
    { id: 'threeDays', span: 'threeDays', layout: 'grid' },
    { id: 'day', span: 'day', layout: 'grid' },
    { id: 'agenda', span: 'twoWeeks', layout: 'list' },
  ],
}

/** A view a width does not offer, shown as one it does: a month on a phone is its agenda. */
const STAND_INS: Record<'wide' | 'narrow', Partial<Record<CalendarView, ViewRow>>> = {
  wide: {},
  narrow: { month: { id: 'agenda', span: 'month', layout: 'list' } },
}

const STEP: Record<Exclude<ViewSpan, 'month'>, number> = {
  day: 1,
  threeDays: 3,
  week: 7,
  twoWeeks: 14,
}

const widthOf = (narrow: boolean) => (narrow ? 'narrow' : 'wide')

/** The views to offer at this width. */
export const viewsAt = (narrow: boolean): readonly ViewRow[] => VIEWS[widthOf(narrow)]

/**
 * The view to show at this width: the wanted one when the width has it, its
 * stand-in, else the width's first choice (the week on a wide calendar, one
 * day on a phone).
 */
export const viewAt = (wanted: CalendarView, narrow: boolean): ViewRow => {
  const rows = VIEWS[widthOf(narrow)]
  return (
    rows.find((row) => row.id === wanted) ??
    STAND_INS[widthOf(narrow)][wanted] ??
    rows.find((row) => row.id === (narrow ? 'day' : 'week'))!
  )
}

/** The days a view shows from its anchor day: its month, a week from Saturday, or a run from the anchor. */
export const daysOf = (span: ViewSpan, anchor: string): string[] =>
  span === 'month'
    ? monthOf(anchor)
    : span === 'week'
      ? weekOf(weekStartOf(anchor))
      : Array.from({ length: STEP[span] }, (_, index) => addDays(anchor, index))

/** The anchor after a step back (-1) or forward (1). */
export const stepFrom = (span: ViewSpan, anchor: string, direction: 1 | -1): string =>
  span === 'month' ? addMonths(anchor, direction) : addDays(anchor, STEP[span] * direction)
