import type { FieldServerComponent } from 'payload'

import { calendarAdminProps } from './calendar-admin-props'
import { RepeatWeekly } from './repeat-weekly'

/** "Repeat weekly" in a session's form, beside its meetings. */
export const RepeatWeeklyField: FieldServerComponent = ({ req }) => (
  <RepeatWeekly {...calendarAdminProps(req)} />
)
