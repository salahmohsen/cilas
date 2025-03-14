import { relations } from "drizzle-orm";
import { integer, pgTable, primaryKey } from "drizzle-orm/pg-core";
import blogsTable from "./blog";
import blogCategoriesTable from "./blog.category";

const blogsToCategoriesTable = pgTable(
  "blogs_to_categories",
  {
    blogId: integer("blog_id")
      .notNull()
      .references(() => blogsTable.id, { onDelete: "cascade" }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => blogCategoriesTable.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.blogId, t.categoryId] })],
);

export const blogsToCategoriesRelations = relations(
  blogsToCategoriesTable,
  ({ one }) => ({
    blog: one(blogsTable, {
      fields: [blogsToCategoriesTable.blogId],
      references: [blogsTable.id],
    }),
    category: one(blogCategoriesTable, {
      fields: [blogsToCategoriesTable.categoryId],
      references: [blogCategoriesTable.id],
    }),
  }),
);

export default blogsToCategoriesTable;
