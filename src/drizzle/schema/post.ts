import { relations } from "drizzle-orm";
import {
  boolean,
  json,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { authorsTable } from ".";
import { JSONContent } from "./course";
import blogsToCategoriesTable from "./post.to.category";
import postsToTagsTable from "./post.to.tag";



const postsTable = pgTable("posts", {
  id: serial("id").primaryKey(),
  isDraft: boolean("is_draft").notNull().default(true),
  slug: varchar("slug", { length: 255 }).unique().notNull(),
  enTitle: varchar("en_title", { length: 255 }).notNull(),
  enContent: json("en_content").$type<JSONContent>().notNull(),
  arTitle: varchar("ar_title", { length: 255 }).notNull(),
  arContent: json("ar_content").$type<JSONContent>().notNull(),
  excerpt: text("excerpt"),
  featuredImage: text("featured_image"),
  publishedAt: timestamp("published_at", { mode: "date", withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const postsRelations = relations(postsTable, ({ many }) => ({
  authors: many(authorsTable),
  tags: many(postsToTagsTable),
  categories: many(blogsToCategoriesTable),
}));

export default postsTable;
