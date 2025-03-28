import { relations } from "drizzle-orm";
import { boolean, integer, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import postsTable from "./post";
import authorRules from "./post.author.rule";
import userTable from "./user";

const authorsTable = pgTable(
  "author_to_role",
  {
    authorId: text("author_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    postId: integer("post_id")
      .notNull()
      .references(() => postsTable.id, { onDelete: "cascade" }),
    ruleId: integer("rule_id")
      .notNull()
      .references(() => authorRules.id, { onDelete: "cascade" }),
    isMainAuthor: boolean("is_main_author").default(false),
  },
  (t) => [primaryKey({ columns: [t.authorId, t.postId] })],
);

const authorsRelations = relations(authorsTable, ({ one }) => ({
  author: one(userTable, {
    fields: [authorsTable.authorId],
    references: [userTable.id],
  }),
  post: one(postsTable, {
    fields: [authorsTable.postId],
    references: [postsTable.id],
  }),
  rule: one(authorRules, {
    fields: [authorsTable.ruleId],
    references: [authorRules.id],
  }),
}));

export default authorsTable;
