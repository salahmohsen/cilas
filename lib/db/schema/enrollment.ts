import { relations } from "drizzle-orm";
import {
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import courseTable from "./course";
import userTable from "./user";

const enrollmentTable = pgTable(
  "course_enrollment",
  {
    courseId: integer("course_id")
      .notNull()
      .references(() => courseTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    enrollmentDate: timestamp("enrollment_date", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    paidAmount: integer("paid_amount"),
    paymentDate: timestamp("payment_date", { mode: "date", withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.courseId, t.userId] })],
);

export const enrollmentRelations = relations(enrollmentTable, ({ one }) => ({
  course: one(courseTable, {
    fields: [enrollmentTable.courseId],
    references: [courseTable.id],
  }),
  user: one(userTable, {
    fields: [enrollmentTable.userId],
    references: [userTable.id],
  }),
}));

export default enrollmentTable;
