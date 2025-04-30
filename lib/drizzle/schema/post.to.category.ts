import { relations } from "drizzle-orm";
import { integer, pgTable, primaryKey } from "drizzle-orm/pg-core";
import postTable from "./post";
import postCategoriesTable from "./post.categories";

const postToCategory = pgTable(
  "post_to_category",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => postTable.id, { onDelete: "cascade" }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => postCategoriesTable.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.postId, t.categoryId] })],
);

export const postToCategoryRelations = relations(postToCategory, ({ one }) => ({
  post: one(postTable, {
    fields: [postToCategory.postId],
    references: [postTable.id],
  }),
  category: one(postCategoriesTable, {
    fields: [postToCategory.categoryId],
    references: [postCategoriesTable.id],
  }),
}));

export default postToCategory;
