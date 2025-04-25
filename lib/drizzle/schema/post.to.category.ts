import { relations } from "drizzle-orm";
import { integer, pgTable, primaryKey } from "drizzle-orm/pg-core";
import postsTable from "./post";
import postCategoriesTable from "./post.categories";

const postToCategory = pgTable(
  "post_to_category",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => postsTable.id, { onDelete: "cascade" }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => postCategoriesTable.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.postId, t.categoryId] })],
);

export const postToCategoryRelations = relations(postToCategory, ({ one }) => ({
  post: one(postsTable, {
    fields: [postToCategory.postId],
    references: [postsTable.id],
  }),
  category: one(postCategoriesTable, {
    fields: [postToCategory.categoryId],
    references: [postCategoriesTable.id],
  }),
}));

export default postToCategory;
