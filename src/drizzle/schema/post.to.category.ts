import { primaryKey, integer, pgTable } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

import { postCategories } from './post.category';
import { posts } from './post';

export const postsToCategories = pgTable(
  'post_to_categories',
  {
    categoryId: integer('category_id')
      .notNull()
      .references(() => postCategories.id, { onDelete: 'cascade' }),
    postId: integer('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' })
  },
  (t) => [primaryKey({ columns: [t.postId, t.categoryId] })]
);

export const postsToCategoriesRelations = relations(
  postsToCategories,
  ({ one }) => ({
    category: one(postCategories, {
      fields: [postsToCategories.categoryId],
      references: [postCategories.id]
    }),
    post: one(posts, {
      fields: [postsToCategories.postId],
      references: [posts.id]
    })
  })
);
