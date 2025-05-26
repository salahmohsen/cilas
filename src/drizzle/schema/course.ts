import {
  customType,
  timestamp,
  boolean,
  integer,
  pgTable,
  varchar,
  serial,
  date,
  json,
  text
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

import { enrollments } from './enrollment';
import { user } from './auth-schema';

export type JSONContent = {
  marks?: {
    attrs?: Record<string, unknown>;
    [key: string]: unknown;
    type: string;
  }[];
  attrs?: Record<string, unknown>;
  content?: JSONContent[];
  [key: string]: unknown;
  text?: string;
  type?: string;
};

type TimeSlot = {
  from: Date;
  to: Date;
};

const timeSlot = customType<{ data: TimeSlot }>({
  fromDriver: (value: unknown): TimeSlot => {
    // Runtime validation
    if (typeof value === 'object' && value !== null) {
      const slot = value as { from?: string; to?: string };
      return {
        from: new Date(slot.from || Date.now()),
        to: new Date(slot.to || Date.now())
      };
    }
    throw new Error('Invalid time slot format');
  },
  toDriver: (value: TimeSlot): unknown => ({
    from: value.from.toISOString(),
    to: value.to.toISOString()
  }),
  dataType: () => 'json'
});

export const courses = pgTable('course', {
  days: json('days').$type<
    {
      disable?: boolean;
      label: string;
      value: string;
    }[]
  >(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
  isRegistrationOpen: boolean('is_registration_open').notNull().default(false),
  suggestedPrice: json('suggestedPrice').notNull().$type<[number, number]>(),
  fellowId: text('fellow_id')
    .notNull()
    .references(() => user.id),
  attendance: varchar('attendance', { length: 50 }).notNull(),
  startDate: date('start_date', { mode: 'date' }).notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  endDate: date('end_date', { mode: 'date' }).notNull(),
  arContent: json('ar_content').$type<JSONContent>(),
  enContent: json('en_content').$type<JSONContent>(),
  draftMode: boolean('draft_mode').default(true),
  arTitle: varchar('ar_title', { length: 255 }),
  enTitle: varchar('en_title', { length: 255 }),
  timeSlot: timeSlot('time_slot').notNull(),
  featuredImage: text('featured_image'),
  maxStudents: integer('max_students'),
  id: serial('id').primaryKey(),
  applyUrl: text('apply_url')
});

export const coursesRelations = relations(courses, ({ many, one }) => ({
  fellow: one(user, {
    fields: [courses.fellowId],
    references: [user.id]
  }),
  enrollments: many(enrollments)
}));
