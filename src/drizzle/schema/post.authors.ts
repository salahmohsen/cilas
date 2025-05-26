import {
  primaryKey,
  boolean,
  integer,
  pgTable,
  text
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

import { authorRoles, posts, user } from './';

export const authors = pgTable(
  'authors_table',
  {
    roleId: integer('role_id')
      .notNull()
      .references(() => authorRoles.id, { onDelete: 'cascade' }),
    authorId: text('author_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    postId: integer('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    isMainAuthor: boolean('is_main_author').default(false)
  },
  (t) => [primaryKey({ columns: [t.authorId, t.postId] })]
);

export const authorsRelations = relations(authors, ({ one }) => ({
  role: one(authorRoles, {
    references: [authorRoles.id],
    fields: [authors.roleId]
  }),
  author: one(user, {
    fields: [authors.authorId],
    references: [user.id]
  }),
  post: one(posts, {
    fields: [authors.postId],
    references: [posts.id]
  })
}));
