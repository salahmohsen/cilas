import { relations } from "drizzle-orm";
import { integer, pgTable, primaryKey } from "drizzle-orm/pg-core";
import postTable from "./post";
import postTagsTable from "./post.tag";

const postToTagTable = pgTable(
  "post_to_tag",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => postTable.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => postTagsTable.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.postId, t.tagId] })],
);

export const postToTagRelations = relations(postToTagTable, ({ one }) => ({
  post: one(postTable, {
    fields: [postToTagTable.postId],
    references: [postTable.id],
  }),
  tag: one(postTagsTable, {
    fields: [postToTagTable.tagId],
    references: [postTagsTable.id],
  }),
}));

export default postToTagTable;
