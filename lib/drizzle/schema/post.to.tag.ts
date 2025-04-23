import { relations } from "drizzle-orm";
import { integer, pgTable, primaryKey } from "drizzle-orm/pg-core";
import postsTable from "./post";
import postTagsTable from "./post.tag";

const postsToTagsTable = pgTable(
  "blogs_to_tags",
  {
    postId: integer("blog_id")
      .notNull()
      .references(() => postsTable.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => postTagsTable.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.postId, t.tagId] })],
);

export const postsToTagsRelations = relations(postsToTagsTable, ({ one }) => ({
  post: one(postsTable, {
    fields: [postsToTagsTable.postId],
    references: [postsTable.id],
  }),
  tag: one(postTagsTable, {
    fields: [postsToTagsTable.tagId],
    references: [postTagsTable.id],
  }),
}));

export default postsToTagsTable;
