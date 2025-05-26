import { primaryKey, integer, pgTable } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

import { postSeries, posts } from './';

export const postToSeries = pgTable(
  'post_to_series',
  {
    seriesId: integer('series_id')
      .notNull()
      .references(() => postSeries.id, { onDelete: 'cascade' }),
    postId: integer('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    order: integer('order').notNull().default(0)
  },
  (t) => [primaryKey({ columns: [t.seriesId, t.postId] })]
);

export const postToSeriesRelations = relations(postToSeries, ({ one }) => ({
  series: one(postSeries, {
    fields: [postToSeries.seriesId],
    references: [postSeries.id]
  }),
  post: one(posts, {
    fields: [postToSeries.postId],
    references: [posts.id]
  })
}));
