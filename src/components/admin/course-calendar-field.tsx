import type { FieldServerComponent } from 'payload'

import { calendarAdminProps } from './calendar-admin-props'
import { CourseCalendar } from './course-calendar'

import './dashboard/arc-scope.css'
import styles from './course-calendar.module.css'

/** The course's sessions on a calendar, above the course-wide fields of the Sessions tab. */
export const CourseCalendarField: FieldServerComponent = ({ data, req }) => {
  const props = calendarAdminProps(req)
  return (
    <div
      className={`arc-scope ${styles.field}`}
      dir={props.language === 'ar' ? 'rtl' : 'ltr'}
      lang={props.language}
    >
      <CourseCalendar courseId={data.id ? String(data.id) : null} {...props} />
    </div>
  )
}
