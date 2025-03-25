import { relations } from "drizzle-orm";
import { integer, pgTable, primaryKey } from "drizzle-orm/pg-core";
import seriesTable from "./post.series";
import postsTable from "./post";

const blogToSeriesTable = pgTable(
  "series_posts",
  {
    seriesId: integer("series_id")
      .notNull()
      .references(() => seriesTable.id, { onDelete: "cascade" }),
    postId: integer("post_id")
      .notNull()
      .references(() => postsTable.id, { onDelete: "cascade" }),
    order: integer("order").notNull().default(0),
  },
  (t) => ({
    primaryKey: primaryKey({ columns: [t.seriesId, t.postId] }),
  }),
);

export const blogToSeriesRelations = relations(blogToSeriesTable, ({ one }) => ({
  series: one(seriesTable, {
    fields: [blogToSeriesTable.seriesId],
    references: [seriesTable.id],
  }),
  post: one(postsTable, {
    fields: [blogToSeriesTable.postId],
    references: [postsTable.id],
  }),
}));

export default blogToSeriesTable;
