import { primaryKey, integer, pgTable } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

import { postTags } from './post.tag';
import { posts } from './post';

export const postsToTags = pgTable(
  'post_to_tags',
  {
    tagId: integer('tag_id')
      .notNull()
      .references(() => postTags.id, { onDelete: 'cascade' }),
    postId: integer('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' })
  },
  (t) => [primaryKey({ columns: [t.postId, t.tagId] })]
);

export const postsToTagsRelations = relations(postsToTags, ({ one }) => ({
  tag: one(postTags, {
    fields: [postsToTags.tagId],
    references: [postTags.id]
  }),
  post: one(posts, {
    fields: [postsToTags.postId],
    references: [posts.id]
  })
}));

export default postsToTags;
