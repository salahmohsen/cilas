import {
  primaryKey,
  timestamp,
  integer,
  pgTable,
  varchar,
  text
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

import { user } from './auth-schema';
import { courses } from './course';

export const enrollments = pgTable(
  'course_enrollment',
  {
    enrollmentDate: timestamp('enrollment_date', {
      withTimezone: true,
      mode: 'date'
    })
      .notNull()
      .defaultNow(),
    courseId: integer('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    paymentDate: timestamp('payment_date', {
      withTimezone: true,
      mode: 'date'
    }),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    paidAmount: integer('paid_amount')
  },
  (t) => [primaryKey({ columns: [t.courseId, t.userId] })]
);

export const enrollmentRelations = relations(enrollments, ({ one }) => ({
  course: one(courses, {
    fields: [enrollments.courseId],
    references: [courses.id]
  }),
  user: one(user, {
    fields: [enrollments.userId],
    references: [user.id]
  })
}));
