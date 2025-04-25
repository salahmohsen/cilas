import { relations } from "drizzle-orm";
import { pgTable, serial, timestamp, varchar } from "drizzle-orm/pg-core";
import postToTagTable from "./post.to.tag";

const postTagsTable = pgTable("post_tags", {
  id: serial("id").primaryKey(),
  enName: varchar("en_name", { length: 100 }).unique().notNull(),
  arName: varchar("ar_name", { length: 100 }).unique().notNull(),
  slug: varchar("slug", { length: 150 }).unique().notNull(),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const blogTagRelations = relations(postTagsTable, ({ many }) => ({
  blogs: many(postToTagTable),
}));

export default postTagsTable;
