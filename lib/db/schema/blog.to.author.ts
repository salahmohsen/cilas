import { relations } from "drizzle-orm";
import { boolean, integer, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import blogsTable from "./blog";
import userTable from "./user";

const blogAuthorsTable = pgTable(
  "blog_authors",
  {
    blogId: integer("blog_id")
      .notNull()
      .references(() => blogsTable.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    isMainAuthor: boolean("is_main_author").notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.blogId, t.authorId] })],
);

export const blogAuthorRelations = relations(blogAuthorsTable, ({ one }) => ({
  blog: one(blogsTable, {
    fields: [blogAuthorsTable.blogId],
    references: [blogsTable.id],
  }),
  author: one(userTable, {
    fields: [blogAuthorsTable.authorId],
    references: [userTable.id],
  }),
}));

export default blogAuthorsTable;
