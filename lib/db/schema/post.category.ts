import { relations } from "drizzle-orm";
import { pgTable, serial, timestamp, varchar } from "drizzle-orm/pg-core";
import blogsToCategoriesTable from "./post.to.category";

const postCategoriesTable = pgTable("post_categories", {
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

export const blogCategoryRelations = relations(postCategoriesTable, ({ many }) => ({
  blogs: many(blogsToCategoriesTable),
}));

export default postCategoriesTable;
