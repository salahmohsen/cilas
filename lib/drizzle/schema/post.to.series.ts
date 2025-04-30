import { relations } from "drizzle-orm";
import { integer, pgTable, primaryKey } from "drizzle-orm/pg-core";
import postTable from "./post";
import seriesTable from "./post.series";

const blogToSeriesTable = pgTable(
  "series_posts",
  {
    seriesId: integer("series_id")
      .notNull()
      .references(() => seriesTable.id, { onDelete: "cascade" }),
    postId: integer("post_id")
      .notNull()
      .references(() => postTable.id, { onDelete: "cascade" }),
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
  post: one(postTable, {
    fields: [blogToSeriesTable.postId],
    references: [postTable.id],
  }),
}));

export default blogToSeriesTable;
