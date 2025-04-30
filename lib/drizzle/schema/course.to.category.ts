import { relations } from "drizzle-orm";
import { integer, pgTable, primaryKey } from "drizzle-orm/pg-core";
import courseTable from "./course";
import courseCategoriesTable from "./course.categories";

const courseToCategory = pgTable(
  "course_to_category",
  {
    courseId: integer("course_id")
      .notNull()
      .references(() => courseTable.id, { onDelete: "cascade" }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => courseCategoriesTable.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.courseId, t.categoryId] })],
);

export const courseToCategoryRelations = relations(courseToCategory, ({ one }) => ({
  course: one(courseTable, {
    fields: [courseToCategory.courseId],
    references: [courseTable.id],
  }),
  category: one(courseCategoriesTable, {
    fields: [courseToCategory.categoryId],
    references: [courseCategoriesTable.id],
  }),
}));

export default courseToCategory;
