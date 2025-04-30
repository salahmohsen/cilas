import { relations } from "drizzle-orm";
import { integer, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import courseTable from "./course";
import userTable from "./user";

const courseFellowTable = pgTable(
  "course_fellow",
  {
    courseId: integer("course_id")
      .notNull()
      .references(() => courseTable.id, { onDelete: "cascade" }),
    fellowId: text("fellow_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.courseId, t.fellowId] })],
);

export const courseFellowRelations = relations(courseFellowTable, ({ one }) => ({
  course: one(courseTable, {
    fields: [courseFellowTable.courseId],
    references: [courseTable.id],
  }),
  fellow: one(userTable, {
    fields: [courseFellowTable.fellowId],
    references: [userTable.id],
  }),
}));

export default courseFellowTable;
