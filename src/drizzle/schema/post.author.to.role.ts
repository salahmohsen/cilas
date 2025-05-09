import { relations } from "drizzle-orm";
import { boolean, integer, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import authorRules from "./post.author.role";
import userTable from "./user";

const authorToRoleTable = pgTable(
  "author_to_role",
  {
    authorId: text("author_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),

    roleId: integer("rule_id")
      .notNull()
      .references(() => authorRules.id, { onDelete: "cascade" }),

    isMainAuthor: boolean("is_main_author").notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.authorId, t.roleId] })],
);

export const postAuthorRelations = relations(authorToRoleTable, ({ one }) => ({
  author: one(userTable, {
    fields: [authorToRoleTable.authorId],
    references: [userTable.id],
  }),
  role: one(authorRules, {
    fields: [authorToRoleTable.roleId],
    references: [authorRules.id],
  }),
}));

export default authorToRoleTable;
