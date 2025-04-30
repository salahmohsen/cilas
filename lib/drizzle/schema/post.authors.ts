import { relations } from "drizzle-orm";
import { boolean, integer, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import postTable from "./post";
import authorRoles from "./post.author.role";
import userTable from "./user";

const authorsTable = pgTable(
  "authors_table",
  {
    authorId: text("author_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    postId: integer("post_id")
      .notNull()
      .references(() => postTable.id, { onDelete: "cascade" }),
    roleId: integer("role_id")
      .notNull()
      .references(() => authorRoles.id, { onDelete: "cascade" }),
    isMainAuthor: boolean("is_main_author").default(false),
  },
  (t) => [primaryKey({ columns: [t.authorId, t.postId] })],
);

export const authorsRelations = relations(authorsTable, ({ one }) => ({
  author: one(userTable, {
    fields: [authorsTable.authorId],
    references: [userTable.id],
  }),
  post: one(postTable, {
    fields: [authorsTable.postId],
    references: [postTable.id],
  }),
  role: one(authorRoles, {
    fields: [authorsTable.roleId],
    references: [authorRoles.id],
  }),
}));

export default authorsTable;
