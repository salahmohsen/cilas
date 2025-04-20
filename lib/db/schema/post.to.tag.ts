import { relations } from "drizzle-orm";
import { integer, pgTable, primaryKey } from "drizzle-orm/pg-core";
import blogsTable from "./post";
import postTagsTable from "./post.tag";

const blogsToTagsTable = pgTable(
  "blogs_to_tags",
  {
    postId: integer("blog_id")
      .notNull()
      .references(() => blogsTable.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => postTagsTable.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.postId, t.tagId] })],
);

export const blogsToTagsRelations = relations(blogsToTagsTable, ({ one }) => ({
  blog: one(blogsTable, {
    fields: [blogsToTagsTable.postId],
    references: [blogsTable.id],
  }),
  tag: one(postTagsTable, {
    fields: [blogsToTagsTable.tagId],
    references: [postTagsTable.id],
  }),
}));

export default blogsToTagsTable;
