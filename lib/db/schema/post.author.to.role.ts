import { relations } from "drizzle-orm";
import { boolean, integer, pgTable, primaryKey } from "drizzle-orm/pg-core";
import authorRules from "./post.author.rule";
import userTable from "./user";

const authorToRoleTable = pgTable(
  "author_to_role",
  {
    authorId: integer("author_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),

    ruleId: integer("rule_id")
      .notNull()
      .references(() => authorRules.id, { onDelete: "cascade" }),

    isMainAuthor: boolean("is_main_author").notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.authorId, t.ruleId] })],
);

export const blogAuthorRelations = relations(authorToRoleTable, ({ one }) => ({
  author: one(userTable, {
    fields: [authorToRoleTable.authorId],
    references: [userTable.id],
  }),
  rule: one(authorRules, {
    fields: [authorToRoleTable.ruleId],
    references: [authorRules.id],
  }),
}));

export default authorToRoleTable;
