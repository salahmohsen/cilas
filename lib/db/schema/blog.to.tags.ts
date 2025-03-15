import { relations } from "drizzle-orm";
import { integer, pgTable, primaryKey } from "drizzle-orm/pg-core";
import blogsTable from "./post";
import blogTagsTable from "./post.tag";

const blogsToTagsTable = pgTable(
  "blogs_to_tags",
  {
    blogId: integer("blog_id")
      .notNull()
      .references(() => blogsTable.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => blogTagsTable.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.blogId, t.tagId] })],
);

export const blogsToTagsRelations = relations(blogsToTagsTable, ({ one }) => ({
  blog: one(blogsTable, {
    fields: [blogsToTagsTable.blogId],
    references: [blogsTable.id],
  }),
  tag: one(blogTagsTable, {
    fields: [blogsToTagsTable.tagId],
    references: [blogTagsTable.id],
  }),
}));

export default blogsToTagsTable;
