import { integer, pgTable, primaryKey } from "drizzle-orm/pg-core";
import userTable from "./user";
import postsTable from "./post";
import authorRules from "./post.author.rule";

const blogAuthorsTable = pgTable(
  "author_to_role",
  {
    authorId: integer("author_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    postId: integer("post_id")
      .notNull()
      .references(() => postsTable.id, { onDelete: "cascade" }),
    ruleId: integer("rule_id")
      .notNull()
      .references(() => authorRules.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.authorId, t.postId] })],
);
